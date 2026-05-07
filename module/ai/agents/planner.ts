import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { parseJsonFromText } from "./types";

export async function runPlanner(
  title: string,
  description: string,
  diff: string
): Promise<{ agentsToActivate: string[]; planNotes: string }> {
  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    temperature: 0.1,
    maxOutputTokens: 1024,
    system: `You are a code review planning agent. Your job is to analyze a pull request and decide which specialist agents should review it.

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

Return ONLY valid JSON.`,
    prompt: `PR Title: ${title}
PR Description: ${description || "No description provided"}

Code Diff (first 3000 chars):
\`\`\`diff
${diff.slice(0, 3000)}
\`\`\`

Decide which agents to activate. Return JSON:
{
  "agentsToActivate": ["agent1", "agent2", ...],
  "planNotes": "Brief explanation of why each agent was chosen"
}`,
  });
  
  return parseJsonFromText(text);
}
