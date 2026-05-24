/**
 * Review Evaluator Agent — scores the quality of the final review.
 *
 * Runs AFTER the Synthesizer produces the markdown review. Checks:
 *   1. Are all findings traceable to specific lines in the diff?
 *   2. Are suggestions syntactically valid and copy-pasteable?
 *   3. Are there any hallucinated issues?
 *   4. What obvious issues in the diff were missed?
 *
 * If the score is below threshold, returns corrections so the Synthesizer
 * can be re-run with targeted feedback.
 */

import { CriticReport, parseJsonFromText } from "./types";
import { generateTextWithFallback, getModel } from "@/module/ai/lib/model-provider";

export interface EvaluationResult {
  /** Overall quality score 0-100 */
  score: number;
  /** Per-dimension scores */
  traceability: number;       // Are findings backed by the diff? (0-10)
  suggestionQuality: number;  // Are suggestions valid, runnable code? (0-10)
  completeness: number;       // Were obvious issues covered? (0-10)
  accuracy: number;           // Are findings factually correct? (0-10)
  /** Issues found in the review itself */
  problems: string[];
  /** Missed issues the evaluator spotted in the diff */
  missedIssues: string[];
  /** Whether the review should be regenerated */
  shouldRegenerate: boolean;
  /** Specific feedback to improve the review if regenerated */
  regenerationHints: string[];
}

const QUALITY_THRESHOLD = 60;

export async function runEvaluator(
  review: string,
  diff: string,
  criticReport: CriticReport,
  title: string
): Promise<EvaluationResult> {
  const text = await generateTextWithFallback({
    model: getModel("critic"), // Use strong tier — evaluator needs to be at least as good as the reviewer
    temperature: 0.1,
    maxOutputTokens: 4096,
    system: `You are a code review quality evaluator. You receive a completed AI-generated code review and the original diff. Your job is to score the review's quality and catch any issues.

Score each dimension 0-10:

1. **Traceability** (0-10): Does every finding reference a real file and line from the diff? Deduct points for:
   - Findings that reference files not in the diff
   - Line numbers that don't exist in the changed hunks
   - Vague references like "in the code" without specifics

2. **Suggestion Quality** (0-10): Are code suggestions valid? Deduct points for:
   - Pseudo-code instead of real code
   - Syntactically broken suggestions
   - Suggestions that don't actually fix the issue
   - Missing imports or context needed to apply the fix

3. **Completeness** (0-10): Did the review cover obvious issues? Look for:
   - Obvious bugs in the diff that weren't mentioned
   - Security issues that were missed
   - Error handling gaps that were overlooked

4. **Accuracy** (0-10): Are the findings factually correct? Deduct for:
   - Findings about code that doesn't exist in the diff (hallucinations)
   - Misunderstanding what the code does
   - False positives presented as real issues

Overall score = weighted average: (traceability × 3 + accuracy × 3 + suggestionQuality × 2 + completeness × 2) / 10 × 10

Set shouldRegenerate = true ONLY if score < ${QUALITY_THRESHOLD}.

Return ONLY valid JSON:
{
  "score": 75,
  "traceability": 8,
  "suggestionQuality": 7,
  "completeness": 6,
  "accuracy": 9,
  "problems": ["Finding #2 references line 45 but the change is on line 52", ...],
  "missedIssues": ["The unchecked null dereference on line 30 of utils.ts", ...],
  "shouldRegenerate": false,
  "regenerationHints": []
}`,
    prompt: `PR Title: ${title}

THE REVIEW BEING EVALUATED:
${review.slice(0, 8000)}

THE ACTUAL DIFF (ground truth — use this to verify every claim in the review):
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

VERIFIED FINDINGS THAT THE REVIEW SHOULD COVER (${criticReport.verifiedFindings.length}):
${JSON.stringify(criticReport.verifiedFindings.slice(0, 15), null, 2)}

Score this review. Be strict — a good review must be grounded in the actual diff.`,
  });

  try {
    const result = parseJsonFromText(text) as EvaluationResult;

    // Recalculate score from dimensions to prevent LLM from gaming it
    const recalculated = Math.round(
      ((result.traceability ?? 5) * 3 +
        (result.accuracy ?? 5) * 3 +
        (result.suggestionQuality ?? 5) * 2 +
        (result.completeness ?? 5) * 2) / 10 * 10
    );

    result.score = recalculated;
    result.shouldRegenerate = recalculated < QUALITY_THRESHOLD;

    console.log(
      `[evaluator] Score: ${result.score}/100 | Trace: ${result.traceability} | Accuracy: ${result.accuracy} | Suggestions: ${result.suggestionQuality} | Completeness: ${result.completeness}${result.shouldRegenerate ? " → REGENERATE" : ""}`
    );

    return result;
  } catch {
    console.error("[evaluator] Failed to parse evaluation result, assuming pass");
    return {
      score: 70,
      traceability: 7,
      suggestionQuality: 7,
      completeness: 7,
      accuracy: 7,
      problems: [],
      missedIssues: [],
      shouldRegenerate: false,
      regenerationHints: [],
    };
  }
}
