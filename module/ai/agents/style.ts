import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { SpecialistReport, parseJsonFromText } from "./types";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function runStyleAgent(
  diff: string,
  context: string[],
  title: string,
  customInstructions?: string[]
): Promise<SpecialistReport> {
  const { text } = await generateText({
    model: groq("llama-3.3-70b-versatile"),
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

Example output:
{
  "agentName": "style",
  "findings": [
    {
      "severity": "medium",
      "confidence": 0.85,
      "file": "components/UserCard.tsx",
      "line": 23,
      "title": "Magic number used for pagination limit",
      "description": "The number 25 is used directly in the query without explanation. This makes it hard to find and change later, and its meaning is unclear to other developers.",
      "suggestion": "Extract to a named constant: const USERS_PER_PAGE = 25;",
      "codeSnippet": "const users = await db.user.findMany({ take: 25 })"
    }
  ],
  "summary": "Found 1 medium-severity maintainability issue with a magic number.",
  "analysisNotes": "Medium confidence — hardcoded numeric literal in a query with no surrounding context explaining it."
}`,
    prompt: `PR Title: ${title}

Codebase Context (from vector search):
${context.length > 0 ? context.join("\n---\n") : "No additional context available."}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Analyze these changes for code quality and maintainability issues. Return ONLY valid JSON matching the schema shown in your instructions.${customInstructions?.length ? `\n\nAdditional team rules to enforce:\n${customInstructions.map((r) => `- ${r}`).join("\n")}` : ""}`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
