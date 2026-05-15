import { SpecialistReport, RejectionPattern, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

export async function runPerformanceAgent(
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
- If the diff introduces a change that interacts with existing code in the context, trace the full call path before concluding whether a performance issue exists
${doNotSection}

--- EXAMPLE 1 (high finding — N+1 query) ---
{
  "agentName": "performance",
  "findings": [
    {
      "severity": "high",
      "confidence": 0.92,
      "file": "api/users.ts",
      "line": 87,
      "title": "N+1 query in user list endpoint",
      "description": "Each user in the loop triggers a separate SELECT for their profile. With 1000 users this produces 1001 queries instead of 2, causing ~500ms added latency per request.",
      "suggestion": "Use include/join: prisma.user.findMany({ include: { profile: true } })",
      "codeSnippet": "for (const user of users) { const profile = await prisma.profile.findUnique({ where: { userId: user.id } }) }"
    }
  ],
  "summary": "Found 1 high-severity N+1 query that will cause linear query growth with user count.",
  "analysisNotes": "High confidence — explicit loop with individual DB query per iteration on line 87."
}

--- EXAMPLE 2 (medium finding — missing pagination) ---
{
  "agentName": "performance",
  "findings": [
    {
      "severity": "medium",
      "confidence": 0.80,
      "file": "app/dashboard/page.tsx",
      "line": 34,
      "title": "Unbounded findMany loads entire table",
      "description": "prisma.review.findMany() with no 'take' limit loads every row in the reviews table. As the table grows this will exhaust memory and time out.",
      "suggestion": "Add pagination: prisma.review.findMany({ take: 50, skip: page * 50, orderBy: { createdAt: 'desc' } })",
      "codeSnippet": "const reviews = await prisma.review.findMany({ where: { userId } })"
    }
  ],
  "summary": "Found 1 medium-severity unbounded query that will degrade as data grows.",
  "analysisNotes": "Medium confidence — no 'take' clause present, but table may still be small in dev."
}

--- EXAMPLE 3 (no issues found) ---
{
  "agentName": "performance",
  "findings": [],
  "summary": "No performance issues detected. The changes use batch operations and appropriate pagination throughout.",
  "analysisNotes": "Reviewed all DB queries, React hooks, and import patterns — no bottlenecks found."
}`,
    prompt: `PR Title: ${title}

Codebase Context (from vector search):
${context.length > 0 ? context.map((c, i) => `[Related file ${i+1}]:\n${c}`).join("\n---\n") : "No additional context available."}
${focusHint ? `\nPlanner Focus Hint: ${focusHint}` : ""}

Code Changes (lines prefixed with L<n>+ are additions at that line, L<n>- are deletions):
\`\`\`diff
${diff}
\`\`\`

Analyze these changes for performance issues. Return ONLY valid JSON matching the schema shown in your instructions.${customInstructions?.length ? `\n\nAdditional team rules to enforce:\n${customInstructions.map((r) => `- ${r}`).join("\n")}` : ""}`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
