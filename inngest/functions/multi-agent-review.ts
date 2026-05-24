import { inngest } from "../client";
import { Octokit } from "octokit";
import prisma from "@/lib/db";
import { createGitProvider } from "@/module/ai/lib/git-provider";
import { retrieveContext } from "@/module/ai/lib/rag";
import { prepareDiffForAgents, getChangedFilenames, calculateComplexityScore, hashDiff, annotateDiffWithLineNumbers, scaledTopK } from "@/module/ai/lib/diff-parser";
import { runPlanner } from "@/module/ai/agents/planner";
import { runSecurityAgent } from "@/module/ai/agents/security";
import { runPerformanceAgent } from "@/module/ai/agents/performance";
import { runLogicAgent } from "@/module/ai/agents/logic";
import { runStyleAgent } from "@/module/ai/agents/style";
import { runCritic } from "@/module/ai/agents/critic";
import { runSynthesizer } from "@/module/ai/agents/synthesizer";
import { runEvaluator } from "@/module/ai/agents/evaluator";
import type { SpecialistReport, RejectionPattern } from "@/module/ai/agents/types";
import { partitionFindings } from "@/module/ai/lib/finding-verifier";
import { fetchRepoConfig, type CodeLaxConfig } from "@/module/ai/lib/config";
import { sendSlackNotification } from "@/module/ai/lib/notifications";

export const generateReviewMultiAgent = inngest.createFunction(
  {
    id: "generate-review-multi-agent",
    concurrency: 3,
    retries: 2,
    onFailure: async ({ event }) => {
      // Mark the most recent in_progress review for this PR as failed
      try {
        const { owner, repo, prNumber } = event.data.event.data;
        const repository = await prisma.repository.findFirst({
          where: { owner, name: repo },
        });
        if (repository) {
          await prisma.review.updateMany({
            where: {
              repositoryId: repository.id,
              prNumber,
              status: "in_progress",
            },
            data: { status: "failed" },
          });
        }
      } catch (e) {
        console.error("Failed to mark review as failed:", e);
      }
    },
  },
  { event: "pr.review.requested" },

  async ({ event, step }) => {
    const { owner, repo, prNumber, userId, action, before, after, provider: eventProvider } = event.data;
    const startTime = Date.now();

    // Helper to update progress step
    const updateStep = async (reviewId: string | undefined, stepName: string) => {
      if (!reviewId) return;
      await prisma.review.update({
        where: { id: reviewId },
        data: { currentStep: stepName },
      }).catch(() => {});
    };

    // Step 0: Create pending review record for status tracking
    const reviewRecord = await step.run("create-pending-review", async () => {
      const repository = await prisma.repository.findFirst({
        where: { owner, name: repo }
      });
      if (!repository) return null;

      return await prisma.review.create({
        data: {
          repositoryId: repository.id,
          prNumber,
          prTitle: `PR #${prNumber}`,
          prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
          status: "in_progress",
          currentStep: "fetching",
          startedAt: new Date(),
        }
      });
    });

    // Determine which git provider to use
    const gitProviderName = (eventProvider as string) ?? "github";
    const providerId = gitProviderName === "gitlab" ? "gitlab" : gitProviderName === "bitbucket" ? "bitbucket" : "github";

    // Step 1: Fetch PR data + repo config + get access token
    const { diff, title, description, token, config, isIncremental } = await step.run("fetch-pr-data", async () => {
      const account = await prisma.account.findFirst({
        where: { userId, providerId }
      });

      if (!account?.accessToken) throw new Error(`No ${providerId} access token found`);

      const gitProvider = createGitProvider(providerId, account.accessToken);

      let diffText: string;
      let prTitle: string;
      let prDescription: string;
      let incremental = false;

      // Incremental review: only get diff between before/after commits on push
      if (action === "synchronize" && before && after) {
        diffText = await gitProvider.fetchIncrementalDiff(owner, repo, before as string, after as string);
        // Still need full PR metadata
        const prData = await gitProvider.fetchPR(owner, repo, prNumber);
        prTitle = prData.title;
        prDescription = prData.description;
        incremental = true;
      } else {
        const prData = await gitProvider.fetchPR(owner, repo, prNumber);
        diffText = prData.diff;
        prTitle = prData.title;
        prDescription = prData.description;
      }

      // Fetch repo config (only available for GitHub currently)
      let repoConfig: CodeLaxConfig = {};
      if (providerId === "github") {
        const octokit = new Octokit({ auth: account.accessToken });
        repoConfig = await fetchRepoConfig(octokit, owner, repo);
      }

      return {
        diff: diffText,
        title: prTitle,
        description: prDescription,
        token: account.accessToken,
        config: repoConfig,
        isIncremental: incremental
      };
    });

    // Update review title now that we have it
    if (reviewRecord) {
      await step.run("update-review-title", async () => {
        await prisma.review.update({
          where: { id: reviewRecord.id },
          data: { prTitle: title },
        });
      });
    }

    // Step 1.5: Dedup check — skip if we already reviewed this exact diff
    const diffDigest = hashDiff(diff);
    const isDuplicate = await step.run("dedup-check", async () => {
      const existing = await prisma.review.findFirst({
        where: {
          diffHash: diffDigest,
          status: "completed",
          id: { not: reviewRecord?.id ?? "" },
        },
      });
      return !!existing;
    });

    if (isDuplicate) {
      if (reviewRecord) {
        await step.run("mark-skipped", async () => {
          await prisma.review.update({
            where: { id: reviewRecord.id },
            data: { status: "skipped", review: "Skipped: identical diff already reviewed." },
          });
        });
      }
      return { success: true, skipped: true, reason: "duplicate diff" };
    }

    // Create GitHub Check Run (in-progress)
    const checkRunId = await step.run("create-check-run", async () => {
      try {
        const octokit = new Octokit({ auth: token });
        const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
        const { data: check } = await octokit.rest.checks.create({
          owner,
          repo,
          name: "CodeLax AI Review",
          head_sha: pr.head.sha,
          status: "in_progress",
          started_at: new Date().toISOString(),
          output: {
            title: "AI Review in progress...",
            summary: "CodeLax is analyzing your pull request with multiple specialist agents.",
          },
        });
        return check.id;
      } catch (e) {
        console.error("Failed to create check run (may need checks:write permission):", e);
        return null;
      }
    });

    // Step 2: Prepare — parse diff, retrieve RAG context, and plan agents (combined for speed)
    await updateStep(reviewRecord?.id, "planning");
    const { processedDiff, rawProcessedDiff, filesSummary, context, plan, complexity } = await step.run("prepare", async () => {
      const result = prepareDiffForAgents(diff, 25000, config.ignore);
      console.log(`[review] ${result.filesSummary}`);

      const complexityResult = calculateComplexityScore(diff);
      console.log(`[review] Complexity: ${complexityResult.score}/100 (${complexityResult.level})`);

      const changedFiles = getChangedFilenames(diff);
      const query = `${title}\n${description}\nChanged files: ${changedFiles.join(", ")}`;

      // Scale topK by diff size — small diffs need fewer context chunks
      const topK = scaledTopK(result.diff.length);
      console.log(`[review] RAG topK=${topK} (diff=${result.diff.length} chars)`);
      const ctx = await retrieveContext(query, `${owner}/${repo}`, topK);

      // Annotate diff with real line numbers to prevent agent hallucination
      const annotatedDiff = annotateDiffWithLineNumbers(result.diff);

      const p = await runPlanner(title, description, result.diff);

      return {
        processedDiff: annotatedDiff,
        rawProcessedDiff: result.diff,
        filesSummary: result.filesSummary,
        context: ctx,
        plan: p,
        complexity: complexityResult,
      };
    });

    // Step 5: Run specialist agents in parallel
    // Use config.agents to limit which agents run, intersected with planner's selection
    const configAgents = config.agents || ["security", "performance", "logic", "style"];
    const plannerAgents = plan.agentsToActivate || ["security", "performance", "logic", "style"];
    const agentsToRun = plannerAgents.filter((a) => configAgents.includes(a as any));

    await updateStep(reviewRecord?.id, `agents:${agentsToRun.join(",")}`);

    // Load rejection patterns from the most recent completed review for this repo
    // so specialist agents can avoid repeat false positives (feedback loop)
    const previousRejectionPatterns = await step.run("load-rejection-patterns", async () => {
      const lastReview = await prisma.review.findFirst({
        where: {
          repository: { owner, name: repo },
          status: "completed",
          rejectionPatterns: { not: null },
        },
        orderBy: { completedAt: "desc" },
      });
      if (!lastReview?.rejectionPatterns) return {} as Record<string, RejectionPattern[]>;
      try {
        const patterns = JSON.parse(lastReview.rejectionPatterns as string) as RejectionPattern[];
        // Group by agentName for easy lookup
        return patterns.reduce<Record<string, RejectionPattern[]>>((acc, p) => {
          (acc[p.agentName] ??= []).push(p);
          return acc;
        }, {});
      } catch {
        return {} as Record<string, RejectionPattern[]>;
      }
    });
    const reports = await step.run("run-specialist-agents", async () => {
      const languages = plan.languages?.length ? plan.languages : [];
      const langContext = languages.length ? [`This PR is primarily written in: ${languages.join(", ")}. Tailor your analysis to ${languages[0]}-specific patterns and best practices.`] : [];
      const instructions = [...langContext, ...(config.instructions || [])];
      const hints = plan.agentFocusHints || {};
      const agentRunners: Record<string, () => Promise<SpecialistReport>> = {
        security: () => runSecurityAgent(processedDiff, context, title, instructions, hints.security, previousRejectionPatterns["security"], languages),
        performance: () => runPerformanceAgent(processedDiff, context, title, instructions, hints.performance, previousRejectionPatterns["performance"], languages),
        logic: () => runLogicAgent(processedDiff, context, title, instructions, hints.logic, previousRejectionPatterns["logic"], languages),
        style: () => runStyleAgent(processedDiff, context, title, instructions, hints.style, previousRejectionPatterns["style"]),
      };

      const activeAgents = agentsToRun.filter((name) => agentRunners[name]);

      const results = await Promise.allSettled(
        activeAgents.map((name) => agentRunners[name]())
      );

      return results.map((result, i) => {
        const agentName = activeAgents[i];
        if (result.status === "fulfilled") {
          return result.value;
        }
        console.error(`Agent ${agentName} failed:`, result.reason);
        return {
          agentName,
          findings: [],
          summary: `Agent ${agentName} failed to analyze this PR.`,
          analysisNotes: `Error: ${result.reason?.message ?? "Unknown error"}`
        } as SpecialistReport;
      });
    });

    // Step 5.5: Deterministic pre-filter — reject hallucinated findings before LLM Critic
    await updateStep(reviewRecord?.id, "verifying");
    const { preFilteredReports, deterministicRejections } = await step.run("deterministic-verify", async () => {
      const allFindings = reports.flatMap((r) =>
        r.findings.map((f) => ({ ...f, agentName: r.agentName }))
      );

      if (allFindings.length === 0) {
        return { preFilteredReports: reports, deterministicRejections: [] as { finding: typeof allFindings[0]; reason: string }[] };
      }

      const { verified, rejected } = partitionFindings(allFindings, diff);
      console.log(`[review] Deterministic pre-filter: ${verified.length} passed, ${rejected.length} rejected out of ${allFindings.length}`);

      // Rebuild reports with only verified findings
      const filteredReports = reports.map((r) => ({
        ...r,
        findings: verified.filter((f) => f.agentName === r.agentName).map(({ agentName: _a, ...rest }) => rest),
      }));

      return { preFilteredReports: filteredReports, deterministicRejections: rejected };
    });

    // Step 6: Critic Agent — deduplicates and filters findings
    await updateStep(reviewRecord?.id, "critic");
    const criticReport = await step.run("critic", () =>
      runCritic(preFilteredReports as unknown as SpecialistReport[], rawProcessedDiff ?? processedDiff, title)
    );

    // Merge deterministic rejections into critic's rejection list
    if (deterministicRejections.length > 0) {
      criticReport.rejectedFindings = [
        ...criticReport.rejectedFindings,
        ...deterministicRejections,
      ];
    }

    // Persist rejection patterns for next run's feedback loop
    if (reviewRecord && criticReport.rejectionPatterns?.length) {
      await step.run("persist-rejection-patterns", async () => {
        await prisma.review.update({
          where: { id: reviewRecord.id },
          data: { rejectionPatterns: JSON.stringify(criticReport.rejectionPatterns) },
        }).catch((e: unknown) => console.warn("[review] Could not persist rejection patterns:", e));
      });
    }

    // Send Slack notification for critical/high findings (non-blocking)
    sendSlackNotification({
      owner,
      repo,
      prNumber,
      prTitle: title,
      findings: criticReport.verifiedFindings,
      overallRisk: criticReport.overallRisk,
    }).catch(() => {});

    await updateStep(reviewRecord?.id, "synthesizer");
    // Step 7: Synthesizer Agent — produces final markdown review
    const complexityBadge = `> **Complexity:** ${complexity.score}/100 (${complexity.level}) | **Files:** ${complexity.breakdown.files} | **Changes:** +${complexity.breakdown.additions}/-${complexity.breakdown.deletions} | **Hotspots:** ${complexity.breakdown.hotspotFiles}\n\n`;
    const reviewPrefix = isIncremental ? "## 🔄 Incremental Review (new commits only)\n\n" : "";
    let finalReview = await step.run("synthesizer", async () => {
      const review = await runSynthesizer(criticReport, processedDiff, title, description, filesSummary);
      return reviewPrefix + complexityBadge + review;
    });

    // Step 7.5: Self-evaluation — score the review and regenerate if quality is too low
    await updateStep(reviewRecord?.id, "evaluating");
    const evaluation = await step.run("evaluate-review", async () => {
      return await runEvaluator(finalReview, rawProcessedDiff ?? processedDiff, criticReport, title);
    });

    // If evaluation score is below threshold, regenerate once with feedback
    if (evaluation.shouldRegenerate && evaluation.regenerationHints.length > 0) {
      console.log(`[review] Evaluation score ${evaluation.score}/100 below threshold — regenerating with feedback`);
      await updateStep(reviewRecord?.id, "regenerating");
      finalReview = await step.run("synthesizer-retry", async () => {
        const feedback = [
          `IMPORTANT: The previous review scored ${evaluation.score}/100 and had these problems:`,
          ...evaluation.problems.map((p) => `- ${p}`),
          ...(evaluation.missedIssues.length > 0 ? [
            `\nMissed issues the evaluator found in the diff:`,
            ...evaluation.missedIssues.map((m) => `- ${m}`),
          ] : []),
          `\nRegeneration instructions:`,
          ...evaluation.regenerationHints.map((h) => `- ${h}`),
        ].join("\n");

        const review = await runSynthesizer(
          criticReport, processedDiff, title,
          description + "\n\n--- QUALITY FEEDBACK ---\n" + feedback,
          filesSummary
        );
        return reviewPrefix + complexityBadge + review;
      });
    }

    console.log(`[review] Final evaluation: score=${evaluation.score}/100, traceability=${evaluation.traceability}, accuracy=${evaluation.accuracy}, suggestions=${evaluation.suggestionQuality}, completeness=${evaluation.completeness}`);

    await updateStep(reviewRecord?.id, "posting");
    // Step 8: Post review with inline comments, auto-labels, check run, save to DB
    const durationMs = Date.now() - startTime;
    await step.run("post-and-save", async () => {
      const gitProvider = createGitProvider(providerId, token);

      // Get the latest commit SHA for inline comments
      const prData = await gitProvider.fetchPR(owner, repo, prNumber);
      const commitSha = prData.headSha;

      // Post the summary review as a PR comment
      await gitProvider.postComment(owner, repo, prNumber, finalReview);

      // Post inline comments based on config
      const MAX_INLINE_COMMENTS = config.maxInlineComments ?? 5;
      const severityOrder = ["critical", "high", "medium", "low"];
      const minSevIndex = severityOrder.indexOf(config.minSeverity ?? "medium");
      const allowedSeverities = severityOrder.slice(0, minSevIndex + 1);
      const inlineFindings = criticReport.verifiedFindings
        .filter((f) => f.line && f.file && allowedSeverities.includes(f.severity))
        .slice(0, MAX_INLINE_COMMENTS);

      const inlineComments = inlineFindings.map((finding) => ({
        file: finding.file,
        line: finding.line!,
        body: [
          `**${finding.severity.toUpperCase()}** — ${finding.title}`,
          "",
          finding.description,
          "",
          finding.suggestion ? `\`\`\`suggestion\n${finding.suggestion}\n\`\`\`` : "",
        ].filter(Boolean).join("\n"),
      }));

      await gitProvider.postInlineComments(owner, repo, prNumber, commitSha, inlineComments);

      // Auto-label PR based on findings
      const labels: string[] = [];
      const hasCritical = criticReport.verifiedFindings.some((f) => f.severity === "critical");
      const hasHigh = criticReport.verifiedFindings.some((f) => f.severity === "high");
      const hasSecurity = criticReport.verifiedFindings.some((f) => f.agentName === "security");
      if (hasCritical) labels.push("critical-issues");
      if (hasHigh && !hasCritical) labels.push("needs-fix");
      if (hasSecurity) labels.push("security-concern");
      if (criticReport.verifiedFindings.length === 0) labels.push("ai-approved");

      if (labels.length > 0) {
        try {
          await gitProvider.addLabels(owner, repo, prNumber, labels);
        } catch (e) {
          console.error("Failed to add labels:", e);
        }
      }

      // Complete the Check Run (GitHub only)
      if (checkRunId && gitProvider.updateCheckRun) {
        try {
          const conclusion = hasCritical ? "failure" : hasHigh ? "neutral" : "success";
          const findingsCount = criticReport.verifiedFindings.length;
          await gitProvider.updateCheckRun(owner, repo, checkRunId, "completed", conclusion, {
            title: findingsCount === 0
              ? "All clear — no issues found"
              : `${findingsCount} finding${findingsCount > 1 ? "s" : ""} (${criticReport.overallRisk} risk)`,
            summary: `**Risk Level:** ${criticReport.overallRisk.toUpperCase()}\n**Findings:** ${findingsCount}\n**Duration:** ${Math.round(durationMs / 1000)}s\n**Complexity:** ${complexity.score}/100 (${complexity.level})\n**Review Quality:** ${evaluation.score}/100`,
          });
        } catch (e) {
          console.error("Failed to update check run:", e);
        }
      }

      // Save/update review in database
      if (reviewRecord) {
        await prisma.review.update({
          where: { id: reviewRecord.id },
          data: {
            review: finalReview,
            status: "completed",
            diffHash: diffDigest,
            completedAt: new Date(),
            durationMs,
            findings: {
              create: criticReport.verifiedFindings.map((f) => ({
                agentName: f.agentName,
                severity: f.severity,
                confidence: f.confidence,
                file: f.file,
                startLine: f.line ?? null,
                endLine: f.line ?? null,
                title: f.title,
                description: f.description,
                suggestion: f.suggestion
              }))
            }
          }
        });
      } else {
        // Fallback: no pending record (shouldn't happen)
        const repository = await prisma.repository.findFirst({
          where: { owner, name: repo }
        });
        if (repository) {
          await prisma.review.create({
            data: {
              repositoryId: repository.id,
              prNumber,
              prTitle: title,
              prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
              review: finalReview,
              status: "completed",
              diffHash: diffDigest,
              completedAt: new Date(),
              durationMs,
              findings: {
                create: criticReport.verifiedFindings.map((f) => ({
                  agentName: f.agentName,
                  severity: f.severity,
                  confidence: f.confidence,
                  file: f.file,
                  startLine: f.line ?? null,
                  endLine: f.line ?? null,
                  title: f.title,
                  description: f.description,
                  suggestion: f.suggestion
                }))
              }
            }
          });
        }
      }
    });

    // Create notifications for the user
    await step.run("create-notifications", async () => {
      const findingsCount = criticReport.verifiedFindings.length;
      const hasCritical = criticReport.verifiedFindings.some((f) => f.severity === "critical");
      const hasHigh = criticReport.verifiedFindings.some((f) => f.severity === "high");
      const reviewLink = reviewRecord ? `/dashboard/reviews/${reviewRecord.id}` : "/dashboard/reviews";

      // Review completed notification
      await prisma.notification.create({
        data: {
          userId,
          type: "review_completed",
          title: `Review completed: ${title}`,
          message: findingsCount === 0
            ? "No issues found — your code looks great!"
            : `Found ${findingsCount} issue${findingsCount > 1 ? "s" : ""} in ${owner}/${repo}#${prNumber}`,
          link: reviewLink,
        },
      });

      // Critical/high severity alert
      if (hasCritical) {
        const critCount = criticReport.verifiedFindings.filter((f) => f.severity === "critical").length;
        await prisma.notification.create({
          data: {
            userId,
            type: "critical_finding",
            title: `Critical issues in ${owner}/${repo}#${prNumber}`,
            message: `${critCount} critical finding${critCount > 1 ? "s" : ""} require immediate attention.`,
            link: reviewLink,
          },
        });
      } else if (hasHigh) {
        const highCount = criticReport.verifiedFindings.filter((f) => f.severity === "high").length;
        await prisma.notification.create({
          data: {
            userId,
            type: "high_finding",
            title: `High severity issues in ${owner}/${repo}#${prNumber}`,
            message: `${highCount} high severity finding${highCount > 1 ? "s" : ""} detected.`,
            link: reviewLink,
          },
        });
      }
    });

    // Log activity event
    await step.run("log-activity", async () => {
      await prisma.activity_event.create({
        data: {
          userId,
          type: "review",
          action: `Review completed for ${owner}/${repo}#${prNumber}`,
          targetType: "review",
          targetId: reviewRecord?.id,
          metadata: JSON.stringify({
            name: title,
            description: `${criticReport.verifiedFindings.length} findings in ${Math.round(durationMs / 1000)}s`,
            prNumber,
            repo: `${owner}/${repo}`,
          }),
        },
      });
    });

    return {
      success: true,
      findingsCount: criticReport.verifiedFindings.length,
      durationMs,
      qualityScore: evaluation.score,
      deterministicRejections: deterministicRejections.length,
      wasRegenerated: evaluation.shouldRegenerate,
    };
  }
);
