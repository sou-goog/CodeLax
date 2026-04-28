import { inngest } from "@/inngest/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const prReviewFunction = inngest.createFunction(
  { id: "pr-review", name: "Review Pull Request" },
  { event: "codelax/pr.review.requested" },

  async ({ event, step }) => {
    const { installationId, repoOwner, repoName, prNumber, prTitle, headSha } = event.data;

    // Step 1 — Authenticate with GitHub as your App
    const octokit = await step.run("authenticate-github", async () => {
      const auth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        installationId,
      });
      const { token } = await auth({ type: "installation" });
      return new Octokit({
        auth: token,
        request: {
          headers: { "X-GitHub-Api-Version": "2022-11-28" }
        }
      });
    });

    // Step 2 — Fetch the PR diff
    const diff = await step.run("fetch-diff", async () => {
      const response = await octokit.pulls.get({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
        mediaType: { format: "diff" },
      });
      return response.data as unknown as string;
    });

    // Step 3 — Send to Gemini for review
    const review = await step.run("gemini-review", async () => {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are an expert code reviewer. Review this pull request diff and provide structured feedback.

PR Title: ${prTitle}

Diff:
${diff.slice(0, 8000)} 

Respond ONLY in this JSON format:
{
  "summary": "One paragraph summary of what this PR does",
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "category": "security|performance|logic|style",
      "description": "Clear description of the issue",
      "file": "filename if identifiable",
      "suggestion": "How to fix it"
    }
  ],
  "positives": ["things done well"],
  "verdict": "approve|request_changes|comment"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      // Strip markdown code fences if present
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    });

    // Step 4 — Format and post back to GitHub as a PR comment
    await step.run("post-comment", async () => {
      const severityEmoji: Record<string, string> = {
        critical: "🔴",
        high: "🟠",
        medium: "🟡",
        low: "🔵",
      };

      const issueRows = review.issues
        .map(
          (i: any) =>
            `| ${severityEmoji[i.severity]} ${i.severity.toUpperCase()} | ${i.category} | ${i.description} | ${i.suggestion} |`
        )
        .join("\n");

      const comment = `## 🤖 CodeLax AI Review

**Summary:** ${review.summary}

---

### Issues Found

| Severity | Category | Issue | Suggestion |
|----------|----------|-------|------------|
${issueRows || "| ✅ | — | No issues found | — |"}

---

### What's Good
${review.positives.map((p: string) => `- ✅ ${p}`).join("\n")}

---

*Powered by CodeLax Multi-Agent Review System*`;

      await octokit.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: prNumber,
        body: comment,
      });
    });

    return { success: true, prNumber, issuesFound: review.issues.length };
  }
);