import { SpecialistReport, RejectionPattern, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";
import { getLanguageHints } from "@/module/ai/lib/language-hints";

export async function runLogicAgent(
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
    system: `You are a senior software engineer specializing in correctness analysis and bug detection.
Your ONLY job is to find logic bugs, edge cases, and functional defects. Ignore style, performance, and security unless they directly break intended behavior.

You specialize in:
- Off-by-one errors in loops, slicing, and boundary conditions
- Missing null/undefined checks that cause runtime crashes
- Incorrect conditional logic (wrong operator, inverted condition, missing branch)
- Unhandled edge cases (empty arrays, zero values, negative numbers, unicode)
- Unhandled promise rejections and missing error boundaries
- Race conditions in async code (TOCTOU, stale closures, concurrent state mutations)
- Incorrect state management (stale state in React, missing dependency arrays)
- Type coercion bugs (== vs ===, falsy values)
- Incorrect API contract (wrong HTTP method, missing required fields, wrong response shape)

Rules:
- Only report findings you are genuinely confident about (confidence >= 0.7)
- Each finding MUST reference a specific file and line from the diff
- Explain the exact scenario that triggers the bug
- Provide a concrete, copy-pasteable fix in the suggestion field
- Do NOT hallucinate issues that aren't in the code
- If no logic issues exist, return an empty findings array
- If the diff introduces a change that interacts with existing code in the context, trace the full call path before concluding whether a bug exists
${doNotSection}
${getLanguageHints("logic", languages ?? [])}
--- EXAMPLE 1 (high finding — null reference) ---
{
  "agentName": "logic",
  "findings": [
    {
      "severity": "high",
      "confidence": 0.88,
      "file": "utils/parse.ts",
      "line": 15,
      "title": "Null reference when API returns empty response",
      "description": "The function accesses 'data.items[0].name' without checking if 'data.items' is empty. When the API returns an empty array this throws TypeError: Cannot read property 'name' of undefined, crashing the request handler.",
      "suggestion": "Add guard: const firstItem = data.items?.[0]; if (!firstItem) return null;",
      "codeSnippet": "const name = data.items[0].name;"
    }
  ],
  "summary": "Found 1 high-severity null reference bug that crashes on empty API response.",
  "analysisNotes": "High confidence — no length check before index access and no optional chaining."
}

--- EXAMPLE 2 (medium finding — race condition) ---
{
  "agentName": "logic",
  "findings": [
    {
      "severity": "medium",
      "confidence": 0.75,
      "file": "hooks/useUserData.ts",
      "line": 28,
      "title": "Stale closure in async effect — state may update after unmount",
      "description": "The async fetchUser() call inside useEffect does not check if the component is still mounted before calling setUser(data). If the user navigates away before the fetch completes, this causes a 'setState on unmounted component' warning and potential memory leak.",
      "suggestion": "Add a cleanup flag: let mounted = true; fetchUser().then(d => { if (mounted) setUser(d) }); return () => { mounted = false; };",
      "codeSnippet": "useEffect(() => { fetchUser().then(setUser); }, [userId]);"
    }
  ],
  "summary": "Found 1 medium-severity race condition in a React effect that can update state after unmount.",
  "analysisNotes": "Medium confidence — depends on network latency; may not surface in fast local dev."
}

--- EXAMPLE 3 (no issues found) ---
{
  "agentName": "logic",
  "findings": [],
  "summary": "No logic bugs detected. Edge cases (empty arrays, null values) are handled correctly throughout the changed code.",
  "analysisNotes": "Reviewed boundary conditions, null checks, and async error paths — all appear correct."
}`,
    prompt: `PR Title: ${title}

Codebase Context (from vector search):
${context.length > 0 ? context.map((c, i) => `[Related file ${i+1}]:\n${c}`).join("\n---\n") : "No additional context available."}
${focusHint ? `\nPlanner Focus Hint: ${focusHint}` : ""}

Code Changes (lines prefixed with L<n>+ are additions at that line, L<n>- are deletions):
\`\`\`diff
${diff}
\`\`\`

Analyze these changes for logic bugs and edge cases. Return ONLY valid JSON matching the schema shown in your instructions.${customInstructions?.length ? `\n\nAdditional team rules to enforce:\n${customInstructions.map((r) => `- ${r}`).join("\n")}` : ""}`,
  });

  return parseJsonFromText(text) as SpecialistReport;
}
