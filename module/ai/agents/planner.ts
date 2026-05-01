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
    prompt: `You are a code review planner. Analyze this PR and decide which specialist review agents are most relevant.

PR Title: ${title}
PR Description: ${description || "No description provided"}
Code Diff (first 2000 chars): ${diff.slice(0, 2000)}

Available agents:
- security: finds auth issues, injection vulnerabilities, data exposure, insecure defaults
- performance: finds N+1 queries, inefficient loops, memory leaks, unnecessary re-renders
- logic: finds off-by-one errors, missing null checks, incorrect conditionals, edge cases
- style: finds naming issues, code duplication, missing types, poor readability

Return ONLY valid JSON in this format:
{
  "agentsToActivate": ["security", "performance", "logic", "style"],
  "planNotes": "Brief explanation of why each agent was chosen"
}`,
  });
  
  return parseJsonFromText(text);
}
