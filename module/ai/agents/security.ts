import { SpecialistReport, RejectionPattern, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";
import { getLanguageHints } from "@/module/ai/lib/language-hints";

export async function runSecurityAgent(
  diff: string,
  context: string[],
  title: string,
  customInstructions?: string[],
  focusHint?: string,
  doNotRules?: RejectionPattern[],
  languages?: string[]
): Promise<SpecialistReport> {
  const doNotSection = doNotRules?.length
    ? `\nDO NOT REPORT (learned from past false positives):\n${doNotRules.map((r) => `- ${r.rule}`).join("\n")}`
    : "";

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
- If the diff introduces a change that interacts with existing code in the context, trace the full call path before concluding whether a vulnerability exists
${doNotSection}
${getLanguageHints("security", languages ?? [])}
--- EXAMPLE 1 (critical finding) ---
{
  "agentName": "security",
  "findings": [
    {
      "severity": "critical",
      "confidence": 0.95,
      "file": "api/auth/login.ts",
      "line": 42,
      "title": "SQL Injection via unsanitized user input",
      "description": "User-supplied 'email' parameter is interpolated directly into a SQL query string without parameterization, allowing an attacker to execute arbitrary SQL via payloads like \\\" OR 1=1 --.",
      "suggestion": "Use parameterized query: db.query('SELECT * FROM users WHERE email = $1', [email])",
      "codeSnippet": "const user = await db.query(\"SELECT * FROM users WHERE email = '\" + email + \"'\")"
    }
  ],
  "summary": "Found 1 critical SQL injection vulnerability in the authentication flow.",
  "analysisNotes": "High confidence — direct string concatenation in SQL query with user input on line 42."
}

--- EXAMPLE 2 (medium finding) ---
{
  "agentName": "security",
  "findings": [
    {
      "severity": "medium",
      "confidence": 0.78,
      "file": "lib/upload.ts",
      "line": 18,
      "title": "Path traversal risk in file upload handler",
      "description": "The uploaded filename is used directly to construct the storage path. A filename like '../../etc/passwd' could write outside the intended directory.",
      "suggestion": "Sanitize the filename: const safe = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');",
      "codeSnippet": "const dest = path.join(UPLOAD_DIR, req.file.originalname);"
    }
  ],
  "summary": "Found 1 medium-severity path traversal risk in the file upload handler.",
  "analysisNotes": "Medium confidence — depends on whether UPLOAD_DIR is inside the web root."
}

--- EXAMPLE 3 (no issues found) ---
{
  "agentName": "security",
  "findings": [],
  "summary": "No security vulnerabilities detected. The changes correctly use parameterized queries and validate user input before processing.",
  "analysisNotes": "Reviewed authentication flow, data access layer, and input handling — all appear safe."
}`,
    prompt: `PR Title: ${title}

Codebase Context (from vector search):
${context.length > 0 ? context.map((c, i) => `[Related file ${i+1}]:\n${c}`).join("\n---\n") : "No additional context available."}
${focusHint ? `\nPlanner Focus Hint: ${focusHint}` : ""}

Code Changes (lines prefixed with L<n>+ are additions at that line, L<n>- are deletions):
\`\`\`diff
${diff}
\`\`\`

Analyze these changes for security vulnerabilities. Return ONLY valid JSON matching the schema shown in your instructions.${customInstructions?.length ? `\n\nAdditional team rules to enforce:\n${customInstructions.map((r) => `- ${r}`).join("\n")}` : ""}`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
