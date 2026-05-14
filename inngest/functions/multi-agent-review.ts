import { inngest } from "../client";
import { Octokit } from "octokit";
import prisma from "@/lib/db";
import { retrieveContext } from "@/module/ai/lib/rag";
import { prepareDiffForAgents, getChangedFilenames, calculateComplexityScore, hashDiff } from "@/module/ai/lib/diff-parser";
import { runPlanner } from "@/module/ai/agents/planner";
import { runSecurityAgent } from "@/module/ai/agents/security";
import { runPerformanceAgent } from "@/module/ai/agents/performance";
import { runLogicAgent } from "@/module/ai/agents/logic";
import { runStyleAgent } from "@/module/ai/agents/style";
import { runCritic } from "@/module/ai/agents/critic";
import { runSynthesizer } from "@/module/ai/agents/synthesizer";
import type { SpecialistReport } from "@/module/ai/agents/types";
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
    const { owner, repo, prNumber, userId, action, before, after } = event.data;
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

    // Step 1: Fetch PR data + repo config + get GitHub token
    const { diff, title, description, token, config, isIncremental } = await step.run("fetch-pr-data", async () => {
      const account = await prisma.account.findFirst({
        where: { userId, providerId: "github" }
      });

      if (!account?.accessToken) throw new Error("No GitHub access token found");

      const octokit = new Octokit({ auth: account.accessToken });

      const [{ data: pr }, repoConfig] = await Promise.all([
        octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
        fetchRepoConfig(octokit, owner, repo),
      ]);

      let diffText: string;
      let incremental = false;

      // Incremental review: only get diff between before/after commits on push
      if (action === "synchronize" && before && after) {
        const { data: compareData } = await octokit.rest.repos.compareCommits({
          owner,
          repo,
          base: before as string,
          head: after as string,
          mediaType: { format: "diff" },
        });
        diffText = compareData as unknown as string;
        incremental = true;
      } else {
        const { data: diffData } = await octokit.rest.pulls.get({
          owner, repo, pull_number: prNumber,
          mediaType: { format: "diff" }
        });
        diffText = diffData as unknown as string;
      }

      return {
        diff: diffText,
        title: pr.title,
        description: pr.body ?? "",
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
    const { processedDiff, filesSummary, context, plan, complexity } = await step.run("prepare", async () => {
      const result = prepareDiffForAgents(diff, 25000, config.ignore);
      console.log(`[review] ${result.filesSummary}`);

      const complexityResult = calculateComplexityScore(diff);
      console.log(`[review] Complexity: ${complexityResult.score}/100 (${complexityResult.level})`);

      const changedFiles = getChangedFilenames(diff);
      const query = `${title}\n${description}\nChanged files: ${changedFiles.join(", ")}`;
      const ctx = await retrieveContext(query, `${owner}/${repo}`, 8);

      const p = await runPlanner(title, description, result.diff);

      return {
        processedDiff: result.diff,
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
    const reports = await step.run("run-specialist-agents", async () => {
      const languages = plan.languages?.length ? plan.languages : [];
      const langContext = languages.length ? [`This PR is primarily written in: ${languages.join(", ")}. Tailor your analysis to ${languages[0]}-specific patterns and best practices.`] : [];
      const instructions = [...langContext, ...(config.instructions || [])];
      const agentRunners: Record<string, () => Promise<SpecialistReport>> = {
        security: () => runSecurityAgent(processedDiff, context, title, instructions),
        performance: () => runPerformanceAgent(processedDiff, context, title, instructions),
        logic: () => runLogicAgent(processedDiff, context, title, instructions),
        style: () => runStyleAgent(processedDiff, context, title, instructions),
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

    // Step 6: Critic Agent — deduplicates and filters findings
    await updateStep(reviewRecord?.id, "critic");
    const criticReport = await step.run("critic", () =>
      runCritic(reports)
    );

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
    const finalReview = await step.run("synthesizer", async () => {
      const review = await runSynthesizer(criticReport, processedDiff, title, description, filesSummary);
      return reviewPrefix + complexityBadge + review;
    });

    await updateStep(reviewRecord?.id, "posting");
    // Step 8: Post review with inline comments, auto-labels, check run, save to DB
    const durationMs = Date.now() - startTime;
    await step.run("post-and-save", async () => {
      const octokit = new Octokit({ auth: token });

      // Get the latest commit SHA for inline comments
      const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
      const commitSha = pr.head.sha;

      // Post the summary review as a PR comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: finalReview
      });

      // Post inline comments based on config
      const MAX_INLINE_COMMENTS = config.maxInlineComments ?? 5;
      const severityOrder = ["critical", "high", "medium", "low"];
      const minSevIndex = severityOrder.indexOf(config.minSeverity ?? "medium");
      const allowedSeverities = severityOrder.slice(0, minSevIndex + 1);
      const inlineFindings = criticReport.verifiedFindings
        .filter((f) => f.line && f.file && allowedSeverities.includes(f.severity))
        .slice(0, MAX_INLINE_COMMENTS);

      for (const finding of inlineFindings) {
        try {
          const body = [
            `**${finding.severity.toUpperCase()}** — ${finding.title}`,
            "",
            finding.description,
            "",
            finding.suggestion ? `\`\`\`suggestion\n${finding.suggestion}\n\`\`\`` : "",
          ].filter(Boolean).join("\n");

          await octokit.rest.pulls.createReviewComment({
            owner,
            repo,
            pull_number: prNumber,
            commit_id: commitSha,
            path: finding.file,
            line: finding.line!,
            body,
          });
        } catch (e) {
          console.error(`Failed to post inline comment on ${finding.file}:${finding.line}`, e);
        }
      }

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
          // Ensure labels exist
          for (const label of labels) {
            try {
              await octokit.rest.issues.getLabel({ owner, repo, name: label });
            } catch {
              const colorMap: Record<string, string> = {
                "critical-issues": "d73a4a",
                "needs-fix": "e4a221",
                "security-concern": "b60205",
                "ai-approved": "0e8a16",
              };
              await octokit.rest.issues.createLabel({
                owner, repo, name: label,
                color: colorMap[label] || "ededed",
                description: `Auto-applied by CodeLax AI review`,
              });
            }
          }
          await octokit.rest.issues.addLabels({ owner, repo, issue_number: prNumber, labels });
        } catch (e) {
          console.error("Failed to add labels:", e);
        }
      }

      // Complete the GitHub Check Run
      if (checkRunId) {
        try {
          const conclusion = hasCritical ? "failure" : hasHigh ? "neutral" : "success";
          const findingsCount = criticReport.verifiedFindings.length;
          await octokit.rest.checks.update({
            owner,
            repo,
            check_run_id: checkRunId,
            status: "completed",
            conclusion,
            completed_at: new Date().toISOString(),
            output: {
              title: findingsCount === 0
                ? "All clear — no issues found"
                : `${findingsCount} finding${findingsCount > 1 ? "s" : ""} (${criticReport.overallRisk} risk)`,
              summary: `**Risk Level:** ${criticReport.overallRisk.toUpperCase()}\n**Findings:** ${findingsCount}\n**Duration:** ${Math.round(durationMs / 1000)}s\n**Complexity:** ${complexity.score}/100 (${complexity.level})`,
            },
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

    return { success: true, findingsCount: criticReport.verifiedFindings.length, durationMs };
  }
);
