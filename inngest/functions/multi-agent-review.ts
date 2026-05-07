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

    // Step 2: Parse and filter diff
    const { processedDiff, filesSummary } = await step.run("parse-diff", async () => {
      const result = prepareDiffForAgents(diff, 30000);
      console.log(`[review] ${result.filesSummary}`);
      return { processedDiff: result.diff, filesSummary: result.filesSummary };
    });

    // Step 3: RAG context retrieval
    const context = await step.run("retrieve-context", async () => {
      const changedFiles = getChangedFilenames(diff);
      const query = `${title}\n${description}\nChanged files: ${changedFiles.join(", ")}`;
      return await retrieveContext(query, `${owner}/${repo}`, 10);
    });

    // Step 4: Planner Agent — decides which agents to activate
    const plan = await step.run("planner", () =>
      runPlanner(title, description, processedDiff)
    );

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

    // Step 8: Post review as GitHub PR comment
    await step.run("post-comment", async () => {
      const octokit = new Octokit({ auth: token });
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: finalReview
      });
    });

    // Step 9: Save review and findings to database
    await step.run("save-review", async () => {
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
