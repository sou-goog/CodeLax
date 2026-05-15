import { SpecialistReport, CriticReport, RejectionPattern, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

// ---------------------------------------------------------------------------
// Severity weights for effective-score calculation.
// effectiveScore = severityWeight × confidence
// This ensures a critical/0.7 outranks a style/0.9.
// ---------------------------------------------------------------------------
const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4.0,
  high: 2.5,
  medium: 1.5,
  low: 0.8,
  info: 0.4,
};

/** Minimum effective score required to keep a finding.  A pure style finding
 *  at confidence 0.9 scores 0.8 × 0.9 = 0.72; a critical at 0.65 scores 4.0 × 0.65 = 2.6. */
const MIN_EFFECTIVE_SCORE = 0.65;

function effectiveScore(severity: string, confidence: number): number {
  const weight = SEVERITY_WEIGHTS[severity] ?? 1.0;
  return weight * confidence;
}

// ---------------------------------------------------------------------------
// Rejection pattern distillation
// ---------------------------------------------------------------------------

/**
 * Cluster rejection reasons by agent and produce concise DO-NOT rules.
 * The LLM is better at reasoning about *categories* than raw strings, so we
 * group by agent and let a short heuristic generate the rule text.
 */
function distillRejectionPatterns(
  rejectedFindings: CriticReport["rejectedFindings"]
): RejectionPattern[] {
  // Bucket by agentName → list of reasons
  const byAgent = new Map<string, string[]>();
  for (const { finding, reason } of rejectedFindings) {
    const agent = finding.agentName ?? "unknown";
    if (!byAgent.has(agent)) byAgent.set(agent, []);
    byAgent.get(agent)!.push(reason);
  }

  const patterns: RejectionPattern[] = [];
  for (const [agentName, reasons] of byAgent.entries()) {
    // Naive dedup: group by first 60 chars of reason
    const counts = new Map<string, number>();
    for (const r of reasons) {
      const key = r.slice(0, 60).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts.entries()) {
      // Only surface patterns that appear at least once (every rejection is signal)
      patterns.push({ agentName, rule: key, count });
    }
  }

  // Sort by count descending so the most frequent patterns come first
  return patterns.sort((a, b) => b.count - a.count).slice(0, 10);
}

export async function runCritic(
  reports: SpecialistReport[],
  diff: string,
  title: string
): Promise<CriticReport> {
  const allFindings = reports.flatMap((r) =>
    r.findings.map((f) => ({ ...f, agentName: r.agentName }))
  );

  if (allFindings.length === 0) {
    return {
      verifiedFindings: [],
      rejectedFindings: [],
      overallRisk: "low",
      rejectionPatterns: [],
    };
  }

  // Pre-filter on effective score before even sending to the LLM.
  // This removes obvious noise cheaply and reduces prompt length.
  const preFiltered = allFindings.filter(
    (f) => effectiveScore(f.severity, f.confidence) >= MIN_EFFECTIVE_SCORE
  );
  const preRejected = allFindings
    .filter((f) => effectiveScore(f.severity, f.confidence) < MIN_EFFECTIVE_SCORE)
    .map((f) => ({
      finding: f,
      reason: `Effective score too low: severity=${f.severity} (weight=${SEVERITY_WEIGHTS[f.severity] ?? 1}), confidence=${f.confidence}, effectiveScore=${effectiveScore(f.severity, f.confidence).toFixed(2)}`,
    }));

  const text = await generateTextWithFallback({
    model: getModel("critic"),
    temperature: 0.15,
    maxOutputTokens: 4096,
    system: `You are a senior engineering lead acting as a quality gate for AI code review findings.
Multiple specialist agents (security, performance, logic, style) have each produced findings. Your job is to:

1. **Verify against the diff**: You have the actual code diff. For each finding, check that the referenced file, line, and code pattern actually exist in the diff. If a finding references code that isn't there, REJECT it
2. **Deduplicate**: If multiple agents reported the same underlying issue (even with different wording), keep only the best one
3. **Filter false positives**: Remove findings that are speculative, vague, or not supported by the actual code diff
4. **Severity-weighted quality gate**: Use the effectiveScore field to judge priority. A critical finding at confidence 0.7 (score 2.8) is more important than a medium at 0.95 (score 1.43). Do NOT reject solely on low raw confidence if the effectiveScore is high
5. **Calibrate severity**: Adjust severity if an agent over- or under-rated an issue
6. **Assess overall risk**: Rate the PR as critical/high/medium/low based on the worst verified finding

Rules:
- You MUST cross-reference each finding with the actual diff — this is your primary job
- Be skeptical but fair — it's worse to let a real bug through than to flag a false positive
- If two agents found the same issue, prefer the one with higher effectiveScore
- Style-only findings should never be rated above "medium"
- A PR with no verified findings should be rated "low" risk
- Include a clear reason for each rejected finding (be specific — this is logged for self-improvement)

Return ONLY valid JSON matching this exact structure:
{
  "verifiedFindings": [
    {
      "severity": "critical",
      "confidence": 0.9,
      "file": "filename",
      "line": 12,
      "title": "title",
      "description": "desc",
      "suggestion": "fix",
      "codeSnippet": "code",
      "agentName": "security"
    }
  ],
  "rejectedFindings": [
    {
      "finding": { "title": "...", "agentName": "..." },
      "reason": "specific, actionable rejection reason"
    }
  ],
  "overallRisk": "critical" | "high" | "medium" | "low"
}`,
    prompt: `You are reviewing ${preFiltered.length} pre-scored findings (${preRejected.length} already rejected by effective-score pre-filter) from ${reports.length} agents for PR: "${title}"

ACTUAL CODE DIFF (use this to verify each finding is real):
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

FINDINGS TO REVIEW (with pre-computed effectiveScore = severityWeight × confidence):
${JSON.stringify(
  preFiltered.map((f) => ({
    ...f,
    _effectiveScore: effectiveScore(f.severity, f.confidence).toFixed(2),
  })),
  null,
  2
)}

For each finding, check it against the actual diff above before deciding KEEP or REJECT.
If you cannot find evidence of the issue in the diff, REJECT it with a clear, specific reason.
Return verified findings as JSON.`,
  });

  const parsed = parseJsonFromText(text) as CriticReport;

  // Merge pre-filter rejections into the LLM's rejection list
  const allRejected = [...(parsed.rejectedFindings ?? []), ...preRejected];

  // Distil rejection patterns for feedback loop
  const rejectionPatterns = distillRejectionPatterns(allRejected);

  return {
    verifiedFindings: parsed.verifiedFindings ?? [],
    rejectedFindings: allRejected,
    overallRisk: parsed.overallRisk ?? "low",
    rejectionPatterns,
  };
}
