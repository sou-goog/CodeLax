/**
 * Deterministic pre-filter for AI findings.
 *
 * Before the Critic LLM even sees a finding, we run cheap mechanical checks:
 *   1. Does the referenced file exist in the diff?
 *   2. Does the referenced line fall within a changed hunk of that file?
 *   3. Is the code snippet actually present in the diff?
 *
 * This eliminates hallucinated findings at zero cost — no LLM call needed.
 */

import type { AgentFinding } from "../agents/types";
import { parseDiffByFile, type ParsedFile } from "./diff-parser";

export interface VerificationResult {
  finding: AgentFinding & { agentName: string };
  passed: boolean;
  failReasons: string[];
}

interface HunkRange {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

/**
 * Extract hunk ranges from a file's diff content.
 */
function extractHunks(diffContent: string): HunkRange[] {
  const hunks: HunkRange[] = [];
  const regex = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/g;
  let match;
  while ((match = regex.exec(diffContent)) !== null) {
    hunks.push({
      oldStart: parseInt(match[1], 10),
      oldCount: parseInt(match[2] ?? "1", 10),
      newStart: parseInt(match[3], 10),
      newCount: parseInt(match[4] ?? "1", 10),
    });
  }
  return hunks;
}

/**
 * Check if a line number falls within any changed hunk of a file.
 * We allow a generous window (±5 lines) because agents sometimes
 * reference the line just above/below the actual change.
 */
function lineInHunks(line: number, hunks: HunkRange[], margin = 5): boolean {
  for (const h of hunks) {
    // Check against new-file line ranges (agents should reference new lines)
    if (line >= h.newStart - margin && line <= h.newStart + h.newCount + margin) {
      return true;
    }
    // Also check old-file ranges (agents sometimes reference the deleted line)
    if (line >= h.oldStart - margin && line <= h.oldStart + h.oldCount + margin) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize a string for fuzzy matching: lowercase, collapse whitespace, strip punctuation.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/['"`;{}()\[\]]/g, "").trim();
}

/**
 * Check if a code snippet appears anywhere in the diff content.
 * Uses normalized fuzzy matching to handle minor formatting differences.
 */
function snippetInDiff(snippet: string, diffContent: string): boolean {
  if (!snippet || snippet.length < 5) return true; // too short to verify

  const normSnippet = normalize(snippet);
  const normDiff = normalize(diffContent);

  // Direct substring match
  if (normDiff.includes(normSnippet)) return true;

  // Try each line of the snippet — if most lines match, it's a pass
  const snippetLines = normSnippet.split(/\n/).map(normalize).filter((l) => l.length > 3);
  if (snippetLines.length === 0) return true;

  let matchedLines = 0;
  for (const line of snippetLines) {
    if (normDiff.includes(line)) matchedLines++;
  }

  // At least 50% of snippet lines found in diff
  return matchedLines / snippetLines.length >= 0.5;
}

/**
 * Normalize filename for comparison: strip leading slashes, "a/", "b/" prefixes,
 * and normalize separators.
 */
function normalizeFilename(f: string): string {
  return f
    .replace(/\\/g, "/")
    .replace(/^[ab]\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

/**
 * Run deterministic verification on a batch of findings against the raw diff.
 *
 * Returns each finding tagged with passed/failed and specific reasons.
 * Findings that fail ALL checks are almost certainly hallucinated.
 */
export function verifyFindings(
  findings: (AgentFinding & { agentName: string })[],
  rawDiff: string
): VerificationResult[] {
  const parsedFiles = parseDiffByFile(rawDiff);
  const fileMap = new Map<string, ParsedFile>();
  const hunkMap = new Map<string, HunkRange[]>();

  for (const f of parsedFiles) {
    const key = normalizeFilename(f.filename);
    fileMap.set(key, f);
    hunkMap.set(key, extractHunks(f.content));
  }

  // Also build a set of all filenames for fuzzy matching
  const allFilenames = Array.from(fileMap.keys());

  return findings.map((finding) => {
    const failReasons: string[] = [];

    // --- Check 1: File exists in diff ---
    const normFile = normalizeFilename(finding.file);
    let matchedFile = fileMap.get(normFile);

    // Try suffix match if exact match fails (agent might say "auth.ts" instead of "src/lib/auth.ts")
    if (!matchedFile) {
      const suffixMatch = allFilenames.find(
        (f) => f.endsWith(normFile) || normFile.endsWith(f)
      );
      if (suffixMatch) {
        matchedFile = fileMap.get(suffixMatch);
      }
    }

    if (!matchedFile) {
      failReasons.push(
        `FILE_NOT_IN_DIFF: "${finding.file}" does not match any file in the diff. Files in diff: [${allFilenames.slice(0, 5).join(", ")}${allFilenames.length > 5 ? "..." : ""}]`
      );
    }

    // --- Check 2: Line number within a changed hunk ---
    if (finding.line && matchedFile) {
      const hunks = hunkMap.get(normalizeFilename(matchedFile.filename)) ?? [];
      if (hunks.length > 0 && !lineInHunks(finding.line, hunks)) {
        failReasons.push(
          `LINE_NOT_IN_HUNK: Line ${finding.line} in "${finding.file}" is not within any changed hunk (±5 line margin). Hunks: ${hunks.map((h) => `+${h.newStart}-${h.newStart + h.newCount}`).join(", ")}`
        );
      }
    }

    // --- Check 3: Code snippet present in diff ---
    if (finding.codeSnippet && matchedFile) {
      if (!snippetInDiff(finding.codeSnippet, matchedFile.content)) {
        failReasons.push(
          `SNIPPET_NOT_FOUND: The code snippet "${finding.codeSnippet.slice(0, 80)}..." was not found in the diff for "${finding.file}"`
        );
      }
    }

    // A finding passes if it has at most 1 minor fail reason.
    // If file isn't in diff at all, that's an automatic fail.
    const hasFileFail = failReasons.some((r) => r.startsWith("FILE_NOT_IN_DIFF"));
    const passed = hasFileFail ? false : failReasons.length <= 1;

    return { finding, passed, failReasons };
  });
}

/**
 * Partition findings into verified and rejected based on deterministic checks.
 */
export function partitionFindings(
  findings: (AgentFinding & { agentName: string })[],
  rawDiff: string
): {
  verified: (AgentFinding & { agentName: string })[];
  rejected: { finding: AgentFinding & { agentName: string }; reason: string }[];
} {
  const results = verifyFindings(findings, rawDiff);

  const verified = results.filter((r) => r.passed).map((r) => r.finding);
  const rejected = results
    .filter((r) => !r.passed)
    .map((r) => ({
      finding: r.finding,
      reason: `DETERMINISTIC_REJECT: ${r.failReasons.join("; ")}`,
    }));

  if (rejected.length > 0) {
    console.log(
      `[finding-verifier] Deterministic pre-filter: ${verified.length} passed, ${rejected.length} rejected`
    );
  }

  return { verified, rejected };
}
