"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { Octokit } from "octokit";

export interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

function parseDiff(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const fileSections = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split("\n");

    // Extract filename
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;
    const filename = headerMatch[2];

    // Detect status
    let status = "modified";
    if (section.includes("new file mode")) status = "added";
    else if (section.includes("deleted file mode")) status = "removed";
    else if (section.includes("rename from")) status = "renamed";

    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;

    // Find hunk headers
    for (let i = 0; i < lines.length; i++) {
      const hunkMatch = lines[i].match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (!hunkMatch) continue;

      const oldStart = parseInt(hunkMatch[1]);
      const newStart = parseInt(hunkMatch[2]);
      const header = lines[i];
      const hunkLines: DiffLine[] = [];

      let oldLine = oldStart;
      let newLine = newStart;

      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        if (line.startsWith("@@ ") || line.startsWith("diff --git ")) break;
        if (line.startsWith("\\ No newline")) continue;

        if (line.startsWith("+")) {
          hunkLines.push({ type: "add", content: line.slice(1), oldLine: null, newLine: newLine++ });
          additions++;
        } else if (line.startsWith("-")) {
          hunkLines.push({ type: "remove", content: line.slice(1), oldLine: oldLine++, newLine: null });
          deletions++;
        } else {
          hunkLines.push({ type: "context", content: line.startsWith(" ") ? line.slice(1) : line, oldLine: oldLine++, newLine: newLine++ });
        }
      }

      hunks.push({ header, oldStart, newStart, lines: hunkLines });
    }

    files.push({ filename, status, additions, deletions, hunks });
  }

  return files;
}

export async function getReviewDiff(reviewId: string): Promise<DiffFile[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const review = await prisma.review.findFirst({
    where: { id: reviewId, repository: { userId: session.user.id } },
    include: { repository: true },
  });
  if (!review) throw new Error("Review not found");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "github" },
  });
  if (!account?.accessToken) throw new Error("No GitHub token");

  const octokit = new Octokit({ auth: account.accessToken });

  const match = review.prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) throw new Error("Invalid PR URL");
  const [, owner, repo] = match;

  const { data: diffData } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: review.prNumber,
    mediaType: { format: "diff" },
  });

  const rawDiff = diffData as unknown as string;
  return parseDiff(rawDiff);
}
