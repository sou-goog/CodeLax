import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SpecialistReport, parseJsonFromText } from "./types";

export async function runSecurityAgent(
  diff: string,
  context: string[],
  title: string
): Promise<SpecialistReport> {
  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    prompt: `You are a security-focused code reviewer. Your ONLY job is to find security vulnerabilities.

Do NOT comment on style, performance, or logic unless it directly causes a security issue.

Focus on:
- SQL/NoSQL injection
- XSS vulnerabilities  
- Authentication/authorization bypasses
- Sensitive data exposure (API keys, tokens, PII in logs)
- Insecure direct object references
- Missing input validation
- Insecure dependencies

PR Title: ${title}
Codebase Context: ${context.join("\n\n")}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Return ONLY valid JSON matching the SpecialistReport schema. Make sure to use the exact keys.
{
  "agentName": "security",
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
  "summary": "one paragraph summary of security posture",
  "analysisNotes": "your confidence reasoning"
}

If no security issues found, return empty findings array with a positive summary.`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
