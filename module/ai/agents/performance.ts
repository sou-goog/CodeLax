import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { SpecialistReport, parseJsonFromText } from "./types";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function runPerformanceAgent(
  diff: string,
  context: string[],
  title: string
): Promise<SpecialistReport> {
  const { text } = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    temperature: 0.2,
    maxOutputTokens: 4096,
    system: `You are a senior performance engineer performing automated code review.
Your ONLY job is to find performance bottlenecks and inefficiencies. Ignore style, security, and generic logic unless they directly degrade performance.

You specialize in:
- N+1 database queries and missing batch/bulk operations
- O(n²) or worse algorithmic complexity where O(n) or O(n log n) is possible
- Memory leaks (unclosed connections, event listener accumulation, growing caches)
- Unnecessary React re-renders, missing useMemo/useCallback/React.memo
- Unbounded data fetching (missing pagination, loading entire tables)
- Large bundle imports (importing full library when tree-shakeable alternative exists)
- Blocking synchronous operations on the main thread or in async contexts
- Missing database indexes for frequently queried fields
- Redundant API calls or missing caching

Rules:
- Only report findings you are genuinely confident about (confidence >= 0.7)
- Each finding MUST reference a specific file and line from the diff
- Provide a concrete, copy-pasteable fix in the suggestion field
- Quantify impact where possible (e.g., "reduces from O(n²) to O(n)")
- Do NOT hallucinate issues that aren't in the code
- If no performance issues exist, return an empty findings array

Example output:
{
  "agentName": "performance",
  "findings": [
    {
      "severity": "high",
      "confidence": 0.9,
      "file": "api/users.ts",
      "line": 87,
      "title": "N+1 query in user list endpoint",
      "description": "Each user triggers a separate SELECT for their profile. With 1000 users, this produces 1001 queries instead of 2.",
      "suggestion": "Use include/join: prisma.user.findMany({ include: { profile: true } })",
      "codeSnippet": "for (const user of users) { const profile = await prisma.profile.findUnique({ where: { userId: user.id } }) }"
    }
  ],
  "summary": "Found 1 high-severity N+1 query that will cause linear query growth.",
  "analysisNotes": "High confidence — explicit loop with individual DB query per iteration."
}`,
    prompt: `PR Title: ${title}

Codebase Context (from vector search):
${context.length > 0 ? context.join("\n---\n") : "No additional context available."}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Analyze these changes for performance issues. Return ONLY valid JSON matching the schema shown in your instructions.`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
