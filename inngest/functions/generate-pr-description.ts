import { inngest } from "../client";
import { Octokit } from "octokit";
import prisma from "@/lib/db";
import { prepareDiffForAgents } from "@/module/ai/lib/diff-parser";
import { fetchRepoConfig } from "@/module/ai/lib/config";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

export const generatePRDescription = inngest.createFunction(
  { id: "generate-pr-description", concurrency: 3 },
  { event: "pr.description.generate" },

  async ({ event, step }) => {
    const { owner, repo, prNumber, userId } = event.data;

    const { diff, title, token, currentBody, autoDescription } = await step.run("fetch-pr-data", async () => {
      const account = await prisma.account.findFirst({
        where: { userId, providerId: "github" }
      });

      if (!account?.accessToken) throw new Error("No GitHub access token found");

      const octokit = new Octokit({ auth: account.accessToken });
      const [{ data: pr }, { data: diffData }, config] = await Promise.all([
        octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
        octokit.rest.pulls.get({ owner, repo, pull_number: prNumber, mediaType: { format: "diff" } }),
        fetchRepoConfig(octokit, owner, repo),
      ]);

      return {
        diff: diffData as unknown as string,
        title: pr.title,
        token: account.accessToken,
        currentBody: pr.body ?? "",
        autoDescription: config.autoDescription !== false
      };
    });

    // Skip if disabled in config or PR already has a description
    if (!autoDescription) {
      return { success: true, skipped: true, reason: "Auto-description disabled in .codelax.yaml" };
    }
    if (currentBody.length > 100) {
      return { success: true, skipped: true, reason: "PR already has a description" };
    }

    const description = await step.run("generate-description", async () => {
      const { diff: processedDiff } = prepareDiffForAgents(diff, 10000);

      const text = await generateTextWithFallback({
        model: getModel("planner"),
        temperature: 0.3,
        maxOutputTokens: 2048,
        system: `You generate concise, informative PR descriptions from code diffs.

Output format (GitHub Markdown):

## What
1-2 sentences explaining what this PR does.

## Why
1-2 sentences explaining the motivation or problem being solved.

## Changes
Bullet list of key changes, grouped by file or feature area. Be specific — reference actual function/component names.

## Testing
Brief note on how to test these changes (or "N/A" if trivial).

Rules:
- Be concise. No filler.
- Use actual names from the code, not vague descriptions.
- If you can't determine "Why" from the diff alone, write "See related issue" instead of guessing.`,
        prompt: `PR Title: ${title}

Code Diff:
\`\`\`diff
${processedDiff}
\`\`\`

Generate the PR description.`,
      });

      return text;
    });

    // Update the PR body
    await step.run("update-pr", async () => {
      const octokit = new Octokit({ auth: token });
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body: description
      });
    });

    return { success: true };
  }
);
