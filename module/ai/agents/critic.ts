import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SpecialistReport, CriticReport, parseJsonFromText } from "./types";

export async function runCritic(
  reports: SpecialistReport[]
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

  const { text } = await generateText({
    model: google("gemini-1.5-pro"),
    temperature: 0.15,
    maxOutputTokens: 4096,
    system: `You are a senior engineering lead acting as a quality gate for AI code review findings.
Multiple specialist agents (security, performance, logic, style) have each produced findings. Your job is to:

1. **Deduplicate**: If multiple agents reported the same underlying issue (even with different wording), keep only the best one
2. **Filter false positives**: Remove findings that are speculative, vague, or not supported by the actual code diff
3. **Confidence threshold**: Only keep findings with confidence >= 0.65
4. **Calibrate severity**: Adjust severity if an agent over- or under-rated an issue
5. **Assess overall risk**: Rate the PR as critical/high/medium/low based on the worst verified finding

Rules:
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
    prompt: `${allFindings.length} findings from ${reports.length} specialist agents to review:

${JSON.stringify(allFindings, null, 2)}

Deduplicate, filter, and return the verified findings as JSON.`,
  });

  return parseJsonFromText(text) as CriticReport;
}
