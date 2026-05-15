import { parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

export interface PlannerResult {
  agentsToActivate: string[];
  planNotes: string;
  languages: string[];
  agentFocusHints: Record<string, string>;
}

export async function runPlanner(
  title: string,
  description: string,
  diff: string
): Promise<PlannerResult> {
  const text = await generateTextWithFallback({
    model: getModel("planner"),
    temperature: 0.1,
    maxOutputTokens: 2048,
    system: `You are a code review planning agent. Your job is to analyze a pull request, decide which specialist agents should review it, and give each agent specific focus hints so they know exactly where to look.

Available agents:
- security: SQL injection, XSS, auth bypasses, secrets exposure, IDOR, input validation
- performance: N+1 queries, O(n²) algorithms, memory leaks, unnecessary re-renders, missing caching
- logic: null refs, off-by-one, race conditions, incorrect conditionals, unhandled edge cases
- style: poor naming, code duplication, missing types, magic numbers, dead code, readability

Guidelines:
- Always include "logic" — it catches the broadest class of bugs
- Include "security" if the diff touches auth, API routes, database queries, user input handling, or env vars
- Include "performance" if the diff touches database queries, loops, data fetching, React components, or API endpoints
- Include "style" for any PR — it catches maintainability issues universally
- When in doubt, include the agent. It's better to run an extra agent than miss a bug
- For very small PRs (< 20 lines of actual changes), you may skip agents that are clearly irrelevant

IMPORTANT: For each activated agent, provide a "focusHint" — a specific instruction telling that agent what files, lines, or patterns to pay special attention to. This is the most valuable thing you produce.

Return ONLY valid JSON.`,
    prompt: `PR Title: ${title}
PR Description: ${description || "No description provided"}

Code Diff (first 6000 chars):
\`\`\`diff
${diff.slice(0, 6000)}
\`\`\`

Decide which agents to activate and what each should focus on. Return JSON:
{
  "agentsToActivate": ["agent1", "agent2", ...],
  "languages": ["typescript", "python", ...],
  "planNotes": "Brief explanation of why each agent was chosen",
  "agentFocusHints": {
    "security": "Pay special attention to lines X-Y in file.ts — detected raw SQL query with user input interpolation",
    "performance": "Check the database query in api/users.ts — appears to fetch all records without pagination",
    "logic": "The conditional on line 34 of utils.ts may not handle null case",
    "style": "Inconsistent naming patterns across the new helper functions"
  }
}
The "languages" field should list the primary programming languages detected in the diff.
The "agentFocusHints" should ONLY include entries for agents in "agentsToActivate". Be specific — reference actual file names, line numbers, and code patterns you see in the diff.`,
  });
  
  return parseJsonFromText(text);
}
