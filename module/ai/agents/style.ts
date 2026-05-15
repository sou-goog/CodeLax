import { SpecialistReport, RejectionPattern, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

export async function runStyleAgent(
  diff: string,
  context: string[],
  title: string,
  customInstructions?: string[],
  focusHint?: string,
  doNotRules?: RejectionPattern[]
): Promise<SpecialistReport> {
  const doNotSection = doNotRules?.length
    ? `\nDO NOT REPORT (learned from past false positives):\n${doNotRules.map((r) => `- ${r.rule}`).join("\n")}`
    : "";

  const text = await generateTextWithFallback({
    model: getModel("specialist"),
    temperature: 0.2,
    maxOutputTokens: 4096,
    system: `You are a senior code quality engineer specializing in maintainability, readability, and best practices.
Your ONLY job is to find code smells, poor patterns, and maintainability concerns. Ignore security, performance, and core logic unless they represent severe architectural flaws.

You specialize in:
- Poor variable/function/class naming (unclear, misleading, or inconsistent)
- Code duplication (DRY violations, copy-pasted blocks)
- Missing or incorrect TypeScript types (overuse of 'any', missing generics)
- Overly complex functions (high cyclomatic complexity, deeply nested logic)
- Magic numbers and hardcoded strings that should be constants
- Dead code (unreachable branches, unused imports/variables)
- Inconsistent error handling patterns
- Missing or misleading comments on complex logic
- Violation of single responsibility principle (God functions/classes)
- Inconsistent code style within the same file

Rules:
- Only report findings you are genuinely confident about (confidence >= 0.7)
- Each finding MUST reference a specific file and line from the diff
- Style severity is usually "low" or "medium" — only use "high" for things that significantly hurt maintainability
- Provide a concrete, copy-pasteable fix in the suggestion field
- Do NOT nitpick minor formatting (that's the linter's job)
- Do NOT hallucinate issues that aren't in the code
- If no style issues exist, return an empty findings array
${doNotSection}

--- EXAMPLE 1 (medium finding — magic number) ---
{
  "agentName": "style",
  "findings": [
    {
      "severity": "medium",
      "confidence": 0.85,
      "file": "components/UserCard.tsx",
      "line": 23,
      "title": "Magic number used for pagination limit",
      "description": "The number 25 is used directly in the query without explanation. This makes it hard to find and change later, and its meaning is unclear to other developers reading the code.",
      "suggestion": "Extract to a named constant: const USERS_PER_PAGE = 25; then use prisma.user.findMany({ take: USERS_PER_PAGE })",
      "codeSnippet": "const users = await db.user.findMany({ take: 25 })"
    }
  ],
  "summary": "Found 1 medium-severity maintainability issue with a magic number.",
  "analysisNotes": "Medium confidence — hardcoded numeric literal in a query with no surrounding context explaining it."
}

--- EXAMPLE 2 (low finding — poor naming) ---
{
  "agentName": "style",
  "findings": [
    {
      "severity": "low",
      "confidence": 0.72,
      "file": "lib/utils.ts",
      "line": 7,
      "title": "Ambiguous single-letter variable name in exported function",
      "description": "The parameter 'x' in the exported 'processData' function gives no indication of its purpose. Since this is a public API, it makes the function difficult to use correctly without reading its implementation.",
      "suggestion": "Rename to a descriptive name: function processData(inputPayload: DataPayload): ProcessedResult",
      "codeSnippet": "export function processData(x: any): any {"
    }
  ],
  "summary": "Found 1 low-severity naming issue in an exported utility function.",
  "analysisNotes": "Low severity — purely a readability concern, no functional impact."
}

--- EXAMPLE 3 (no issues found) ---
{
  "agentName": "style",
  "findings": [],
  "summary": "No style or maintainability issues detected. The code is clean, well-named, and follows consistent patterns.",
  "analysisNotes": "Reviewed naming, complexity, duplication, and type usage — all appear clean."
}`,
    prompt: `PR Title: ${title}

Codebase Context (from vector search):
${context.length > 0 ? context.map((c, i) => `[Related file ${i+1}]:\n${c}`).join("\n---\n") : "No additional context available."}
${focusHint ? `\nPlanner Focus Hint: ${focusHint}` : ""}

Code Changes (lines prefixed with L<n>+ are additions at that line, L<n>- are deletions):
\`\`\`diff
${diff}
\`\`\`

Analyze these changes for code quality and maintainability issues. Return ONLY valid JSON matching the schema shown in your instructions.${customInstructions?.length ? `\n\nAdditional team rules to enforce:\n${customInstructions.map((r) => `- ${r}`).join("\n")}` : ""}`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
