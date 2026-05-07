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

export const generateReviewMultiAgent = inngest.createFunction(
  { id: "generate-review-multi-agent", concurrency: 3 },
  { event: "pr.review.requested" },

  async ({ event, step }) => {
    const { owner, repo, prNumber, userId } = event.data;

    // Step 1: Fetch PR data + get GitHub token
    const { diff, title, description, token } = await step.run("fetch-pr-data", async () => {
      const account = await prisma.account.findFirst({
        where: { userId, providerId: "github" }
      });

      if (!account?.accessToken) throw new Error("No GitHub access token found");

      const octokit = new Octokit({ auth: account.accessToken });

      const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
      const { data: diffData } = await octokit.rest.pulls.get({
        owner, repo, pull_number: prNumber,
        mediaType: { format: "diff" }
      });

      return {
        diff: diffData as unknown as string,
        title: pr.title,
        description: pr.body ?? "",
        token: account.accessToken
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

    // Step 5: Run ALL selected specialist agents IN PARALLEL (major speed improvement)
    // All 4 agents fire simultaneously instead of waiting 10s between each one.
    const agentsToRun = plan.agentsToActivate || ["security", "performance", "logic", "style"];

    const reports = await step.run("run-specialist-agents", async () => {
      const agentRunners: Record<string, () => Promise<SpecialistReport>> = {
        security: () => runSecurityAgent(processedDiff, context, title),
        performance: () => runPerformanceAgent(processedDiff, context, title),
        logic: () => runLogicAgent(processedDiff, context, title),
        style: () => runStyleAgent(processedDiff, context, title),
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

    // Step 7: Synthesizer Agent — produces final markdown review
    const finalReview = await step.run("synthesizer", () =>
      runSynthesizer(criticReport, processedDiff, title, description, filesSummary)
    );

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

      // Post inline comments for top findings (max 5, severity >= medium)
      const MAX_INLINE_COMMENTS = 5;
      const inlineFindings = criticReport.verifiedFindings
        .filter((f) => f.line && f.file && ["critical", "high", "medium"].includes(f.severity))
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
