import { inngest } from "../client";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { Octokit } from "octokit";
import prisma from "@/lib/db";
import { retrieveContext } from "@/module/ai/lib/rag";

export const generateReview = inngest.createFunction(
  { id: "generate-review", concurrency: 5 },
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

    // Step 3: Generate AI review
    const review = await step.run("generate-ai-review", async () => {
      const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a detailed, constructive code review.

PR Title: ${title}
PR Description: ${description || "No description provided"}

Context from Codebase:
${context.join("\n\n")}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Please provide:
1. **Walkthrough**: A file-by-file explanation of the changes.
2. **Summary**: Brief overview of the PR.
3. **Strengths**: What's done well.
4. **Issues**: Bugs, security concerns, code smells.
5. **Suggestions**: Specific code improvements.
6. **Poem**: A short creative poem summarizing the changes.

Format your response in markdown.`;

      const { text } = await generateText({
        model: google("gemini-flash-latest"),
        prompt
      });

      return text;
    });

    // Step 4: Post review as GitHub PR comment
    await step.run("post-comment", async () => {
      const octokit = new Octokit({ auth: token });
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: review
      });
    });

    // Step 5: Save review to database
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
            review,
            status: "completed"
          }
        });
      }
    });

    return { success: true };
  }
);
