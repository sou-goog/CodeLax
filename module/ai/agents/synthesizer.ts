import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { CriticReport, parseJsonFromText } from "./types";

export async function runSynthesizer(
  criticReport: CriticReport,
  diff: string,
  title: string,
  description: string
): Promise<string> {
  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    prompt: `You are a technical writer producing the final PR review.
You have been given pre-verified findings from specialist agents.
Do NOT second-guess or re-analyze. Just format them clearly.

PR Title: ${title}
PR Description: ${description}
Overall Risk: ${criticReport.overallRisk}

Verified Findings:
${JSON.stringify(criticReport.verifiedFindings, null, 2)}

Produce a markdown review with these sections:
1. **Walkthrough** — file-by-file explanation of changes based on the PR diff
2. **Risk Assessment** — overall risk level with justification
3. **Findings** — each finding formatted as:
   ### [SEVERITY] Title (Agent: agentName, Confidence: X%)
   **File:** filename  
   **Description:** ...  
   **Suggestion:** ...  
4. **Strengths** — what was done well
5. **Poem** — a short creative poem about this PR`,
  });

  return text;
}
