import { inngest } from "../client";
import { Octokit } from "octokit";
import prisma from "@/lib/db";
import { retrieveContext } from "@/module/ai/lib/rag";
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

    // Step 2: RAG context retrieval
    const context = await step.run("retrieve-context", async () => {
      const query = `${title}\n${description}`;
      return await retrieveContext(query, `${owner}/${repo}`);
    });

    // Step 3: Planner Agent
    const plan = await step.run("planner", () =>
      runPlanner(title, description, diff)
    );

    // Step 4: Run only the agents the planner selected (with delays for rate limiting)
    const agentsToRun = plan.agentsToActivate || ["security", "performance", "logic", "style"];
    const agentRunners: Record<string, () => Promise<SpecialistReport>> = {
      security: () => runSecurityAgent(diff, context, title),
      performance: () => runPerformanceAgent(diff, context, title),
      logic: () => runLogicAgent(diff, context, title),
      style: () => runStyleAgent(diff, context, title),
    };

    const reports: SpecialistReport[] = [];
    for (const agentName of agentsToRun) {
      if (agentRunners[agentName]) {
        try {
          const report = await step.run(`agent-${agentName}`, agentRunners[agentName]);
          reports.push(report);
        } catch (error) {
          console.error(`Agent ${agentName} failed, skipping:`, error);
          reports.push({
            agentName,
            findings: [],
            summary: `Agent ${agentName} failed to analyze this PR.`,
            analysisNotes: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          });
        }
        await step.sleep(`wait-after-${agentName}`, "10s");
      }
    }

    // Step 5: Critic Agent
    const criticReport = await step.run("critic", () =>
      runCritic(reports)
    );

    // Step 6: Synthesizer Agent
    const finalReview = await step.run("synthesizer", () =>
      runSynthesizer(criticReport, diff, title, description)
    );

    // Step 7: Post review as GitHub PR comment
    await step.run("post-comment", async () => {
      const octokit = new Octokit({ auth: token });
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: finalReview
      });
    });

    // Step 8: Save review and findings to database
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
