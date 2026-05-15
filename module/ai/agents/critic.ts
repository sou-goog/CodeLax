import { SpecialistReport, CriticReport, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

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
    };
  }

  const text = await generateTextWithFallback({
    model: getModel("critic"),
    temperature: 0.15,
    maxOutputTokens: 4096,
    system: `You are a senior engineering lead acting as a quality gate for AI code review findings.
Multiple specialist agents (security, performance, logic, style) have each produced findings. Your job is to:

1. **Verify against the diff**: You have the actual code diff. For each finding, check that the referenced file, line, and code pattern actually exist in the diff. If a finding references code that isn't there, REJECT it
2. **Deduplicate**: If multiple agents reported the same underlying issue (even with different wording), keep only the best one
3. **Filter false positives**: Remove findings that are speculative, vague, or not supported by the actual code diff
4. **Confidence threshold**: Only keep findings with confidence >= 0.65
5. **Calibrate severity**: Adjust severity if an agent over- or under-rated an issue
6. **Assess overall risk**: Rate the PR as critical/high/medium/low based on the worst verified finding

Rules:
- You MUST cross-reference each finding with the actual diff — this is your primary job
- Be skeptical but fair — it's worse to let a real bug through than to flag a false positive
- If two agents found the same issue, prefer the one with higher confidence and better description
- Style-only findings should never be rated above "medium"
- A PR with no verified findings should be rated "low" risk
- Include a clear reason for each rejected finding

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
      "reason": "why rejected"
    }
  ],
  "overallRisk": "critical" | "high" | "medium" | "low"
}`,
    prompt: `You are reviewing ${allFindings.length} findings from ${reports.length} agents for PR: "${title}"

ACTUAL CODE DIFF (use this to verify each finding is real):
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

FINDINGS TO REVIEW:
${JSON.stringify(allFindings, null, 2)}

For each finding, check it against the actual diff above before deciding KEEP or REJECT.
If you cannot find evidence of the issue in the diff, REJECT it with a clear reason.
Return verified findings as JSON.`,
  });

  return parseJsonFromText(text) as CriticReport;
}
