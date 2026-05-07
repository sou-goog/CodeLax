import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { CriticReport, parseJsonFromText } from "./types";

export async function runSynthesizer(
  criticReport: CriticReport,
  diff: string,
  title: string,
  description: string,
  filesSummary?: string
): Promise<string> {
  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    temperature: 0.3,
    maxOutputTokens: 8192,
    system: `You are a senior technical writer producing the final AI code review for a GitHub pull request.
You have been given pre-verified findings from specialist agents (security, performance, logic, style).
Do NOT second-guess the findings or re-analyze the code. Your job is to present them clearly and professionally.

Format the review as polished GitHub-flavored Markdown. Use these exact sections:

1. **📋 Summary** — 2-3 sentence overview of what the PR does and overall quality assessment
2. **📁 Files Changed** — table of files with change counts (if file summary available)
3. **📝 Walkthrough** — brief file-by-file explanation of what changed and why
4. **⚠️ Risk Assessment** — overall risk level (Critical/High/Medium/Low) with 1-sentence justification
5. **🔍 Findings** — each finding as:
   #### [🔴|🟠|🟡|🟢] Title
   | Field | Value |
   |-------|-------|
   | Severity | critical/high/medium/low |
   | Agent | agentName |
   | Confidence | X% |
   | File | \`filename:line\` |
   
   **Issue:** description
   
   **Suggestion:**
   \`\`\`suggestion
   concrete fix code
   \`\`\`
6. **✅ What's Done Well** — 2-3 positive observations about the PR
7. **🎯 Action Items** — numbered list of things the author should fix before merging

Rules:
- Use emoji sparingly but consistently for severity indicators
- Keep the tone professional, constructive, and helpful
- If there are 0 findings, congratulate the author and note the PR looks clean
- Never make up findings that weren't in the verified list`,
    prompt: `PR Title: ${title}
PR Description: ${description || "No description provided"}
Overall Risk: ${criticReport.overallRisk}
${filesSummary ? `\nFiles Summary:\n${filesSummary}` : ""}

Verified Findings (${criticReport.verifiedFindings.length}):
${JSON.stringify(criticReport.verifiedFindings, null, 2)}

Code Diff (for walkthrough context):
\`\`\`diff
${diff.slice(0, 15000)}
\`\`\`

Produce the final review in markdown format.`,
  });

  return text;
}
