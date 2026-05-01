import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SpecialistReport, parseJsonFromText } from "./types";

export async function runStyleAgent(
  diff: string,
  context: string[],
  title: string
): Promise<SpecialistReport> {
  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    prompt: `You are a style and maintainability code reviewer. Your ONLY job is to find code smells, poor naming, and maintainability issues.

Do NOT comment on security, performance, or core logic unless it's a severe architectural flaw.

Focus on:
- Poor variable/function naming
- Code duplication (DRY violations)
- Missing types or overusing "any"
- Poor readability and overly complex functions
- Magic numbers/strings
- Missing comments for complex logic

PR Title: ${title}
Codebase Context: ${context.join("\n\n")}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Return ONLY valid JSON matching the SpecialistReport schema:
{
  "agentName": "style",
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
  "summary": "one paragraph summary of code quality",
  "analysisNotes": "your confidence reasoning"
}

If no style issues found, return empty findings array with a positive summary.`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
