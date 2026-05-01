import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SpecialistReport, parseJsonFromText } from "./types";

export async function runPerformanceAgent(
  diff: string,
  context: string[],
  title: string
): Promise<SpecialistReport> {
  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    prompt: `You are a performance-focused code reviewer. Your ONLY job is to find performance bottlenecks and inefficiencies.

Do NOT comment on style, security, or generic logic unless it directly impacts performance.

Focus on:
- N+1 database queries
- Inefficient loops and Big O complexity issues
- Memory leaks
- Unnecessary React re-renders or missing memoization
- Large payload sizes or inefficient API calls
- Blocking synchronous operations

PR Title: ${title}
Codebase Context: ${context.join("\n\n")}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Return ONLY valid JSON matching the SpecialistReport schema:
{
  "agentName": "performance",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "confidence": 0.9,
      "file": "filename",
      "line": 12,
      "title": "short title",
      "description": "detailed explanation",
      "suggestion": "concrete fix",
      "codeSnippet": "relevant code"
    }
  ],
  "summary": "one paragraph summary of performance impact",
  "analysisNotes": "your confidence reasoning"
}

If no performance issues found, return empty findings array with a positive summary.`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
