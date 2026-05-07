import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { CriticReport, parseJsonFromText } from "./types";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function runSynthesizer(
  criticReport: CriticReport,
  diff: string,
  title: string,
  description: string,
  filesSummary?: string
): Promise<string> {
  const { text } = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    temperature: 0.3,
    maxOutputTokens: 8192,
    system: `You are a senior engineering lead producing a concise, actionable code review for a GitHub pull request.
You receive pre-verified findings from specialist AI agents. Do NOT re-analyze or fabricate issues — only present what was found.

## Output Structure (use these sections in order):

### Summary
2-3 sentences: what the PR does, overall quality, and the #1 thing to fix before merging.

### Risk Assessment
**Risk: [CRITICAL | HIGH | MEDIUM | LOW]** — 1 sentence justification.

### Findings
For each finding:

#### [🔴|🟠|🟡|🟢] {Title}
**File:** \`{file}:{line}\` | **Severity:** {severity} | **Confidence:** {confidence}%

{2-3 sentence explanation of the issue and its real-world impact.}

**Fix:**
\`\`\`suggestion
{The corrected code that replaces the problematic line(s). This MUST be real code, not pseudo-code. GitHub will render this as a one-click "Apply suggestion" button.}
\`\`\`

---

### What's Done Well
2-3 specific positives referencing actual code from the diff.

### Action Items
Numbered list ordered by priority. Each item = one sentence with the file and what to change.

## Rules:
- Be direct. No filler, no fluff, no generic advice.
- Reference real variable names, function names, and files from the diff.
- If 0 findings, keep it short: confirm the PR looks clean and highlight what's done well.
- Never invent findings that weren't in the verified list.`,
    prompt: `PR Title: ${title}
PR Description: ${description || "No description provided"}
Overall Risk Level: ${criticReport.overallRisk.toUpperCase()}
${filesSummary ? `\nFiles Changed Summary:\n${filesSummary}` : ""}

Verified Findings (${criticReport.verifiedFindings.length} total — these are real, confirmed issues):
${JSON.stringify(criticReport.verifiedFindings, null, 2)}

Rejected Findings (${criticReport.rejectedFindings?.length ?? 0} false positives were filtered out by the critic — do NOT include these):
${JSON.stringify(criticReport.rejectedFindings ?? [], null, 2)}

Full Code Diff (use this for the walkthrough and to ground your explanations):
\`\`\`diff
${diff.slice(0, 12000)}
\`\`\`

Now produce the complete, final code review in markdown format. Be detailed, specific, and genuinely helpful.`,
  });

  return text;
}
