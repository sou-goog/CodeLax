import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/** Resolve user from Authorization: Bearer <extensionApiKey> header */
async function getUserFromApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!key) return null;
  return prisma.user.findUnique({ where: { extensionApiKey: key } });
}

/**
 * GET /api/extension/reviews?owner=X&repo=Y&limit=20
 * Returns recent reviews + findings for the given repo.
 * Auth: Bearer <extensionApiKey>
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromApiKey(req);
  if (!user) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo  = searchParams.get("repo");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo query params required" }, { status: 400 });
  }

  const repository = await prisma.repository.findFirst({
    where: { owner, name: repo, userId: user.id },
  });

  if (!repository) {
    return NextResponse.json({ reviews: [], message: "Repository not found or not connected" });
  }

  const reviews = await prisma.review.findMany({
    where: { repositoryId: repository.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      prNumber: true,
      prTitle: true,
      prUrl: true,
      status: true,
      currentStep: true,
      durationMs: true,
      createdAt: true,
      completedAt: true,
      findings: {
        select: {
          id: true,
          agentName: true,
          severity: true,
          confidence: true,
          file: true,
          startLine: true,
          endLine: true,
          title: true,
          description: true,
          suggestion: true,
        },
      },
    },
  });

  return NextResponse.json({ reviews, repoFullName: `${owner}/${repo}` });
}
