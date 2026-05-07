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
    system: `You are a world-class senior engineering lead performing the final code review on a GitHub pull request.
You have been given pre-verified, deduplicated findings from four specialist AI agents: security, performance, logic, and style.
Your job is to synthesize these into an insightful, actionable, and beautifully formatted code review that developers actually want to read.

## Your Output Structure (use EXACTLY these sections in order):

### 📋 Summary
Write 3-5 sentences. Cover:
- What does this PR actually do? (in plain English, not just restating the title)
- What is the overall code quality like?
- The single most important thing the author should address before merging.

### 📁 Files Changed
If a files summary is provided, render it as a markdown table:
| File | Changes |
|------|---------|
| ... | ... |

### 📝 Walkthrough
File-by-file explanation. For each file, write 2-4 sentences explaining:
- What changed and why it matters
- Any notable patterns or concerns (even positive ones)
Use the actual diff to ground your explanations in real code.

### ⚠️ Risk Assessment
**Overall Risk: [CRITICAL | HIGH | MEDIUM | LOW]**
Write 2-3 sentences justifying the risk level based on the worst verified findings.

### 🔍 Findings

For each finding, use this EXACT format:

#### [🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW] {Title}

| | |
|---|---|
| **Severity** | {severity} |
| **Agent** | {agentName} |
| **Confidence** | {confidence}% |
| **File** | \`{file}\` |

**🐛 Issue:**
{Write a detailed description. Don't just repeat the finding — explain WHY this is a problem, WHAT could go wrong in production, and WHO is affected.}

**💡 Fix:**
\`\`\`typescript
{Concrete, copy-pasteable fix code. Make it real — include the actual corrected code, not pseudo-code.}
\`\`\`

---

### ✅ What's Done Well
Write 3-5 specific positive observations grounded in the actual diff. Be specific (e.g., "Good use of parameterized queries in getUserById" not just "good security practices").

### 🎯 Priority Action Items
Numbered list of things to fix, ordered by severity. Each item should be one actionable sentence.

### 🎵 Poem
End with a short 4-line rhyming poem about the PR. Keep it fun and relevant to what was changed.

---
## Tone & Style Rules:
- Be DIRECT and SPECIFIC. Vague comments are useless.
- Reference actual variable names, function names, and line numbers from the diff.
- If there are 0 findings, celebrate it! Write a detailed "what's done well" section and give the PR a glowing review.
- Never fabricate findings that weren't in the verified list.
- Use markdown formatting aggressively — tables, code blocks, bold text — to make this scannable.`,
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
