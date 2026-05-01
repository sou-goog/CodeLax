import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SpecialistReport, CriticReport, parseJsonFromText } from "./types";

export async function runCritic(
  reports: SpecialistReport[]
): Promise<CriticReport> {
  const allFindings = reports.flatMap((r) =>
    r.findings.map((f) => ({ ...f, agentName: r.agentName }))
  );

  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    prompt: `You are a senior critic reviewing findings from 4 specialist agents.
Your job:
1. Remove duplicate findings (same issue reported by multiple agents)
2. Remove false positives (low confidence + minor impact)
3. Keep confidence threshold: only findings with confidence >= 0.6
4. Assign final severity based on context
5. Report your overall risk assessment

All findings to review:
${JSON.stringify(allFindings, null, 2)}

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
      "finding": { ... },
      "reason": "why rejected"
    }
  ],
  "overallRisk": "critical" | "high" | "medium" | "low"
}`,
  });

  return parseJsonFromText(text) as CriticReport;
}
