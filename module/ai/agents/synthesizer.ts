import { CriticReport, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

export async function runSynthesizer(
  criticReport: CriticReport,
  diff: string,
  title: string,
  description: string,
  filesSummary?: string
): Promise<string> {
  const text = await generateTextWithFallback({
    model: getModel("synthesizer"),
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

### Changes Diagram
Generate a Mermaid diagram showing the flow of changes. Wrap it in a \`\`\`mermaid code block.

IMPORTANT Mermaid syntax rules — follow EXACTLY:
- Use \`flowchart LR\` (not \`graph LR\`)
- Node IDs must be simple alphanumeric (A, B, C or short words like Input, Process)
- Edge labels use: \`A -->|label text| B\` (pipe before and after label, NO \`>\` after the closing pipe)
- Nodes with text: \`A[My Node]\` or \`A(My Node)\` or \`A{My Node}\`
- Do NOT use special characters like /, \\, or | inside node text brackets
- Do NOT use \`|>\` anywhere — that is invalid syntax
- Keep it simple: max 6-8 nodes, short labels

Valid example:
\`\`\`mermaid
flowchart LR
  A[User Input] --> B[Validate]
  B -->|valid| C[Process]
  B -->|invalid| D[Error]
  C --> E[Save to DB]
  E --> F[Return Response]
\`\`\`

Only include if the PR has meaningful logic flow. Skip for config-only or single-line changes.

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

  return sanitizeMermaid(text);
}

/**
 * Fix common Mermaid syntax errors that LLMs produce.
 */
function sanitizeMermaid(text: string): string {
  return text.replace(/```mermaid([\s\S]*?)```/g, (match, content: string) => {
    let fixed = content
      // Fix "|label|>" → "|label|" (most common LLM error)
      .replace(/\|([^|]+)\|>/g, '|$1|')
      // Fix "-->|label|>" → "-->|label|"
      .replace(/-->\|([^|]+)\|>/g, '-->|$1|')
      // Fix "|>" at end of lines
      .replace(/\|>\s*$/gm, '|')
      // Remove slashes in node text brackets that break parsing
      .replace(/\[([^\]]*)\/([^\]]*)\]/g, '[$1 or $2]')
      .replace(/\[([^\]]*)\\([^\]]*)\]/g, '[$1 $2]');
    return '```mermaid' + fixed + '```';
  });
}
