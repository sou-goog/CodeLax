import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SpecialistReport, parseJsonFromText } from "./types";

export async function runLogicAgent(
  diff: string,
  context: string[],
  title: string
): Promise<SpecialistReport> {
  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    prompt: `You are a logic-focused code reviewer. Your ONLY job is to find logic bugs, edge cases, and functional defects.

Do NOT comment on style, performance, or security unless it directly breaks the intended functionality.

Focus on:
- Off-by-one errors
- Missing null/undefined checks
- Incorrect conditional logic
- Unhandled edge cases and exceptions
- Race conditions
- Incorrect state management

PR Title: ${title}
Codebase Context: ${context.join("\n\n")}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Return ONLY valid JSON matching the SpecialistReport schema:
{
  "agentName": "logic",
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
  "summary": "one paragraph summary of functional correctness",
  "analysisNotes": "your confidence reasoning"
}

If no logic issues found, return empty findings array with a positive summary.`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
