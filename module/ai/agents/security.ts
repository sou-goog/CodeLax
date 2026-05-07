import { SpecialistReport, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

export async function runSecurityAgent(
  diff: string,
  context: string[],
  title: string,
  customInstructions?: string[]
): Promise<SpecialistReport> {
  const text = await generateTextWithFallback({
    model: getModel("specialist"),
    temperature: 0.2,
    maxOutputTokens: 4096,
    system: `You are an elite application security engineer performing automated code review.
Your ONLY job is to find security vulnerabilities. Ignore style, performance, and logic unless they directly cause a security flaw.

You specialize in:
- SQL/NoSQL injection and query manipulation
- XSS (reflected, stored, DOM-based)
- Authentication/authorization bypasses and privilege escalation
- Sensitive data exposure (API keys, tokens, PII in logs, hardcoded secrets)
- Insecure direct object references (IDOR)
- Missing input validation and sanitization
- Path traversal and file inclusion
- Insecure dependencies with known CVEs
- CSRF and SSRF vulnerabilities

Rules:
- Only report findings you are genuinely confident about (confidence >= 0.7)
- Each finding MUST reference a specific file and line from the diff
- Provide a concrete, copy-pasteable fix in the suggestion field
- Do NOT hallucinate issues that aren't in the code
- If no security issues exist, return an empty findings array

Example output:
{
  "agentName": "security",
  "findings": [
    {
      "severity": "critical",
      "confidence": 0.95,
      "file": "api/auth/login.ts",
      "line": 42,
      "title": "SQL Injection via unsanitized user input",
      "description": "User-supplied 'email' parameter is interpolated directly into a SQL query string without parameterization, allowing an attacker to execute arbitrary SQL.",
      "suggestion": "Use parameterized query: db.query('SELECT * FROM users WHERE email = $1', [email])",
      "codeSnippet": "const user = await db.query(\"SELECT * FROM users WHERE email = '\" + email + \"'\")"
    }
  ],
  "summary": "Found 1 critical SQL injection vulnerability in the authentication flow.",
  "analysisNotes": "High confidence — direct string concatenation in SQL query with user input."
}`,
    prompt: `PR Title: ${title}

Codebase Context (from vector search):
${context.length > 0 ? context.join("\n---\n") : "No additional context available."}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Analyze these changes for security vulnerabilities. Return ONLY valid JSON matching the schema shown in your instructions.${customInstructions?.length ? `\n\nAdditional team rules to enforce:\n${customInstructions.map((r) => `- ${r}`).join("\n")}` : ""}`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
