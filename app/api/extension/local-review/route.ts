import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { runSecurityAgent } from "@/module/ai/agents/security";
import { runPerformanceAgent } from "@/module/ai/agents/performance";
import { runLogicAgent } from "@/module/ai/agents/logic";
import { runStyleAgent } from "@/module/ai/agents/style";
import { runCritic } from "@/module/ai/agents/critic";
import { runPlanner } from "@/module/ai/agents/planner";
import { SpecialistReport } from "@/module/ai/agents/types";
import { partitionFindings } from "@/module/ai/lib/finding-verifier";

async function getUserFromApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!key) return null;

  // Dev bypass: skip DB lookup when running locally
  if (process.env.NODE_ENV !== "production" && key === "dev-test-key") {
    return { id: "dev", name: "Dev User", email: "dev@localhost" };
  }

  return prisma.user.findUnique({ where: { extensionApiKey: key } });
}

/**
 * POST /api/extension/local-review
 * Accepts raw code or a diff and runs the multi-agent AI review pipeline.
 * No GitHub connection required — works with any editor, any git provider.
 *
 * Body: {
 *   code?: string,       // raw file content to review
 *   diff?: string,       // git diff to review (preferred if available)
 *   fileName?: string,   // e.g. "src/utils/auth.ts"
 *   language?: string,   // e.g. "typescript"
 *   title?: string,      // description of what's being reviewed
 * }
 *
 * Auth: Bearer <extensionApiKey>
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromApiKey(req);
  if (!user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const body = await req.json();
  const { code, diff, fileName, language, title } = body as {
    code?: string;
    diff?: string;
    fileName?: string;
    language?: string;
    title?: string;
  };

  if (!code && !diff) {
    return NextResponse.json(
      { error: "Either 'code' or 'diff' must be provided" },
      { status: 400 }
    );
  }

  try {
    // If raw code is provided, wrap it in a pseudo-diff format
    const reviewDiff = diff
      ? diff
      : `--- a/${fileName ?? "file"}\n+++ b/${fileName ?? "file"}\n@@ -0,0 +1,${(code ?? "").split("\n").length} @@\n${(code ?? "").split("\n").map((l) => `+${l}`).join("\n")}`;

    const reviewTitle = title ?? `Local review: ${fileName ?? "untitled"}`;

    // Run planner to decide which agents to activate
    const plan = await runPlanner(reviewTitle, "", reviewDiff);

    const agentsToRun = plan.agentsToActivate ?? [
      "security",
      "performance",
      "logic",
      "style",
    ];
    const hints = plan.agentFocusHints ?? {};

    const langContext = language
      ? [
          `This code is written in ${language}. Tailor your analysis to ${language}-specific patterns and best practices.`,
        ]
      : plan.languages?.length
      ? [
          `This code is primarily written in: ${plan.languages.join(", ")}. Tailor your analysis to ${plan.languages[0]}-specific patterns and best practices.`,
        ]
      : [];

    // Determine languages for language-specific hints
    const languages = language ? [language] : plan.languages ?? [];

    // Run specialist agents in parallel (with language-specific hints)
    const agentRunners: Record<string, () => Promise<SpecialistReport>> = {
      security: () =>
        runSecurityAgent(reviewDiff, [], reviewTitle, langContext, hints.security, undefined, languages),
      performance: () =>
        runPerformanceAgent(reviewDiff, [], reviewTitle, langContext, hints.performance, undefined, languages),
      logic: () =>
        runLogicAgent(reviewDiff, [], reviewTitle, langContext, hints.logic, undefined, languages),
      style: () =>
        runStyleAgent(reviewDiff, [], reviewTitle, langContext, hints.style),
    };

    const activeAgents = agentsToRun.filter((a) => agentRunners[a]);
    const results = await Promise.allSettled(
      activeAgents.map((name) => agentRunners[name]())
    );

    const reports: SpecialistReport[] = results.map((result, i) => {
      if (result.status === "fulfilled") return result.value;
      return {
        agentName: activeAgents[i],
        findings: [],
        summary: `Agent ${activeAgents[i]} failed.`,
        analysisNotes: `Error: ${result.reason?.message ?? "Unknown error"}`,
      } as SpecialistReport;
    });

    // Deterministic pre-filter: only apply when a real git diff is provided.
    // For raw code reviews (no diff), the pseudo-diff paths won't match agent output,
    // so we skip the verifier and let the Critic handle quality filtering.
    let filteredReports = reports;
    let deterministicRejected: { finding: any; reason: string }[] = [];

    if (diff) {
      const allFindings = reports.flatMap((r) =>
        r.findings.map((f) => ({ ...f, agentName: r.agentName }))
      );
      if (allFindings.length > 0) {
        const { verified, rejected } = partitionFindings(allFindings, reviewDiff);
        deterministicRejected = rejected;
        filteredReports = reports.map((r) => ({
          ...r,
          findings: verified.filter((f) => f.agentName === r.agentName).map(({ agentName: _a, ...rest }) => rest),
        }));
      }
    }

    // Run critic to deduplicate and verify
    const criticReport = await runCritic(filteredReports, reviewDiff, reviewTitle);

    // Return findings directly — no DB save needed for local reviews
    return NextResponse.json({
      findings: criticReport.verifiedFindings.map((f) => ({
        agentName: f.agentName,
        severity: f.severity,
        confidence: f.confidence,
        file: f.file ?? fileName ?? "file",
        startLine: f.line ?? null,
        title: f.title,
        description: f.description,
        suggestion: f.suggestion,
      })),
      overallRisk: criticReport.overallRisk,
      rejected: (criticReport.rejectedFindings?.length ?? 0) + deterministicRejected.length,
      deterministicRejections: deterministicRejected.length,
      agents: activeAgents,
    });
  } catch (err) {
    console.error("[local-review] Error:", err);
    return NextResponse.json(
      {
        error: "Review failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
