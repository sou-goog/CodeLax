import { inngest } from "../client";
import { Octokit } from "octokit";
import prisma from "@/lib/db";
import { retrieveContext } from "@/module/ai/lib/rag";
import { prepareDiffForAgents, getChangedFilenames } from "@/module/ai/lib/diff-parser";
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
  { id: "generate-review-multi-agent", concurrency: 3 },
  { event: "pr.review.requested" },

  async ({ event, step }) => {
    const { owner, repo, prNumber, userId, action, before, after } = event.data;

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

    // Step 2: Prepare — parse diff, retrieve RAG context, and plan agents (combined for speed)
    const { processedDiff, filesSummary, context, plan } = await step.run("prepare", async () => {
      const result = prepareDiffForAgents(diff, 25000);
      console.log(`[review] ${result.filesSummary}`);

      const changedFiles = getChangedFilenames(diff);
      const query = `${title}\n${description}\nChanged files: ${changedFiles.join(", ")}`;
      const ctx = await retrieveContext(query, `${owner}/${repo}`, 8);

      const p = await runPlanner(title, description, result.diff);

      return {
        processedDiff: result.diff,
        filesSummary: result.filesSummary,
        context: ctx,
        plan: p,
      };
    });

    // Step 5: Run specialist agents in parallel
    // Use config.agents to limit which agents run, intersected with planner's selection
    const configAgents = config.agents || ["security", "performance", "logic", "style"];
    const plannerAgents = plan.agentsToActivate || ["security", "performance", "logic", "style"];
    const agentsToRun = plannerAgents.filter((a) => configAgents.includes(a as any));

    const reports = await step.run("run-specialist-agents", async () => {
      const instructions = config.instructions || [];
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

    // Step 7: Synthesizer Agent — produces final markdown review
    const reviewPrefix = isIncremental ? "## 🔄 Incremental Review (new commits only)\n\n" : "";
    const finalReview = await step.run("synthesizer", async () => {
      const review = await runSynthesizer(criticReport, processedDiff, title, description, filesSummary);
      return reviewPrefix + review;
    });

    // Step 5: Post review with inline comments + save to DB
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

      // Save to database
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
    });

    return { success: true, findingsCount: criticReport.verifiedFindings.length };
  }
);
