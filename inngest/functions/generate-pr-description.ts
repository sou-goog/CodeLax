import { inngest } from "../client";
import { Octokit } from "octokit";
import prisma from "@/lib/db";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { prepareDiffForAgents } from "@/module/ai/lib/diff-parser";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const generatePRDescription = inngest.createFunction(
  { id: "generate-pr-description", concurrency: 3 },
  { event: "pr.description.generate" },

  async ({ event, step }) => {
    const { owner, repo, prNumber, userId } = event.data;

    const { diff, title, token, currentBody } = await step.run("fetch-pr-data", async () => {
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
        token: account.accessToken,
        currentBody: pr.body ?? ""
      };
    });

    // Skip if PR already has a meaningful description
    if (currentBody.length > 100) {
      return { success: true, skipped: true, reason: "PR already has a description" };
    }

    const description = await step.run("generate-description", async () => {
      const { diff: processedDiff } = prepareDiffForAgents(diff, 10000);

      const { text } = await generateText({
        model: groq("llama-3.3-70b-versatile"),
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
