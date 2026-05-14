"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";

export interface ReviewComparisonData {
  left: ReviewSummary;
  right: ReviewSummary;
  resolvedFindings: string[];
  newFindings: string[];
  persistentFindings: string[];
  severityTrend: { severity: string; left: number; right: number }[];
}

interface ReviewSummary {
  id: string;
  prTitle: string;
  prNumber: number;
  status: string;
  createdAt: string;
  durationMs: number | null;
  totalFindings: number;
  findings: {
    id: string;
    title: string;
    severity: string;
    file: string;
    agentName: string;
  }[];
}

function summarize(review: any): ReviewSummary {
  return {
    id: review.id,
    prTitle: review.prTitle,
    prNumber: review.prNumber,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    durationMs: review.durationMs,
    totalFindings: review.findings.length,
    findings: review.findings.map((f: any) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      file: f.file,
      agentName: f.agentName,
    })),
  };
}

export async function compareReviews(
  leftId: string,
  rightId: string
): Promise<ReviewComparisonData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [left, right] = await Promise.all([
    prisma.review.findFirst({
      where: { id: leftId, repository: { userId: session.user.id } },
      include: { findings: true },
    }),
    prisma.review.findFirst({
      where: { id: rightId, repository: { userId: session.user.id } },
      include: { findings: true },
    }),
  ]);

  if (!left || !right) throw new Error("Review not found");

  const leftSummary = summarize(left);
  const rightSummary = summarize(right);

  // Match findings by title+file to detect resolved/new/persistent
  const leftKeys = new Set(left.findings.map((f) => `${f.title}::${f.file}`));
  const rightKeys = new Set(right.findings.map((f) => `${f.title}::${f.file}`));

  const resolvedFindings = left.findings
    .filter((f) => !rightKeys.has(`${f.title}::${f.file}`))
    .map((f) => `${f.severity.toUpperCase()}: ${f.title} (${f.file})`);

  const newFindings = right.findings
    .filter((f) => !leftKeys.has(`${f.title}::${f.file}`))
    .map((f) => `${f.severity.toUpperCase()}: ${f.title} (${f.file})`);

  const persistentFindings = right.findings
    .filter((f) => leftKeys.has(`${f.title}::${f.file}`))
    .map((f) => `${f.severity.toUpperCase()}: ${f.title} (${f.file})`);

  // Severity trend
  const severities = ["critical", "high", "medium", "low"];
  const severityTrend = severities.map((sev) => ({
    severity: sev,
    left: left.findings.filter((f) => f.severity === sev).length,
    right: right.findings.filter((f) => f.severity === sev).length,
  }));

  return {
    left: leftSummary,
    right: rightSummary,
    resolvedFindings,
    newFindings,
    persistentFindings,
    severityTrend,
  };
}

export async function getReviewsForComparison() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return prisma.review.findMany({
    where: { repository: { userId: session.user.id }, status: "completed" },
    select: { id: true, prTitle: true, prNumber: true, createdAt: true, repository: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
