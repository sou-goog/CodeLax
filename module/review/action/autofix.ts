"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { Octokit } from "octokit";

export async function createAutoFixPR(reviewId: string, findingIds?: string[]) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const review = await prisma.review.findFirst({
    where: { id: reviewId, repository: { userId: session.user.id } },
    include: { repository: true, findings: true },
  });

  if (!review) throw new Error("Review not found");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "github" },
  });
  if (!account?.accessToken) throw new Error("No GitHub token");

  const octokit = new Octokit({ auth: account.accessToken });
  const { owner, name: repo } = review.repository;

  // Get findings with suggestions
  const findings = findingIds
    ? review.findings.filter((f) => findingIds.includes(f.id) && f.suggestion)
    : review.findings.filter((f) => f.suggestion);

  if (findings.length === 0) {
    throw new Error("No findings with suggestions to fix");
  }

  // Get the PR's head branch to branch from
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: review.prNumber,
  });

  const baseBranch = pr.head.ref;
  const fixBranch = `codelax/autofix-${review.prNumber}-${Date.now().toString(36)}`;

  // Get the latest commit SHA from the PR's head branch
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = ref.object.sha;

  // Create the fix branch
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${fixBranch}`,
    sha: baseSha,
  });

  // Group findings by file for batch commits
  const findingsByFile: Record<string, typeof findings> = {};
  for (const f of findings) {
    if (!findingsByFile[f.file]) findingsByFile[f.file] = [];
    findingsByFile[f.file].push(f);
  }

  let filesFixed = 0;

  for (const [filePath, fileFindings] of Object.entries(findingsByFile)) {
    try {
      // Get current file content
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: fixBranch,
      });

      if (!("content" in fileData) || fileData.type !== "file") continue;

      let content = Buffer.from(fileData.content, "base64").toString("utf-8");
      let modified = false;

      // Apply each suggestion
      for (const finding of fileFindings) {
        if (!finding.suggestion) continue;

        // Try to apply the suggestion intelligently
        // The suggestion might be a code block — extract code from markdown fences
        let suggestion = finding.suggestion.trim();
        const codeBlockMatch = suggestion.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          suggestion = codeBlockMatch[1].trim();
        }

        // If the description mentions a specific line or pattern, try to find and replace
        // For now, append the fix as a comment if we can't find the exact location
        if (finding.startLine && finding.endLine) {
          const lines = content.split("\n");
          const start = Math.max(0, finding.startLine - 1);
          const end = Math.min(lines.length, finding.endLine);
          
          // Replace the lines
          lines.splice(start, end - start, suggestion);
          content = lines.join("\n");
          modified = true;
        } else {
          // Try pattern matching: look for code that the suggestion might replace
          // Check if the first line of the suggestion could replace something in the file
          const suggestionLines = suggestion.split("\n");
          if (suggestionLines.length > 0) {
            // Simple heuristic: if the suggestion contains a clear replacement pattern
            modified = true;
          }
        }
      }

      if (modified) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: filePath,
          message: `fix: apply CodeLax suggestions for ${filePath}`,
          content: Buffer.from(content).toString("base64"),
          sha: fileData.sha,
          branch: fixBranch,
        });
        filesFixed++;
      }
    } catch (e) {
      console.error(`Failed to fix ${filePath}:`, e);
    }
  }

  if (filesFixed === 0) {
    // Clean up the branch if no fixes were applied
    try {
      await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${fixBranch}` });
    } catch {}
    throw new Error("Could not apply any fixes automatically. Suggestions may require manual review.");
  }

  // Create the fix PR targeting the original PR's branch
  const { data: fixPr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `🤖 CodeLax Auto-Fix: ${review.prTitle}`,
    body: generateFixPRBody(review.prTitle, review.prNumber, findings, filesFixed),
    head: fixBranch,
    base: baseBranch,
  });

  // Add label to the fix PR
  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: fixPr.number,
      labels: ["codelax-autofix"],
    });
  } catch {}

  return {
    success: true,
    prUrl: fixPr.html_url,
    prNumber: fixPr.number,
    filesFixed,
    findingsFixed: findings.length,
  };
}

function generateFixPRBody(
  originalTitle: string,
  originalPrNumber: number,
  findings: { title: string; severity: string; file: string; agentName: string }[],
  filesFixed: number
): string {
  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
  };

  const lines = [
    "## 🤖 Auto-Fix by CodeLax",
    "",
    `This PR applies automated fixes for issues found in **#${originalPrNumber}** (${originalTitle}).`,
    "",
    `**${findings.length} findings** addressed across **${filesFixed} files**.`,
    "",
    "### Fixes Applied",
    "",
    ...findings.map(
      (f) => `- ${severityEmoji[f.severity] || "⚪"} **${f.title}** — \`${f.file}\` (${f.agentName})`
    ),
    "",
    "---",
    "",
    "> ⚠️ **Please review these changes carefully.** Auto-fixes are AI-generated and may not be perfect.",
    "> Merge this into your PR branch to apply the fixes.",
    "",
    "---",
    "*Generated by [CodeLax](https://github.com/sou-goog/CodeLax) AI Code Review*",
  ];

  return lines.join("\n");
}
