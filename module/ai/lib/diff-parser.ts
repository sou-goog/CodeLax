/**
 * Utilities for parsing and filtering PR diffs before sending to AI agents.
 * Reduces noise, filters irrelevant files, and splits by file for targeted analysis.
 */

export interface ParsedFile {
  filename: string;
  additions: number;
  deletions: number;
  content: string;
}

// Files to always skip — they add noise without value
const SKIP_PATTERNS = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^bun\.lockb$/,
  /\.min\.(js|css)$/,
  /^\.next\//,
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^\.git\//,
  /\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz|woff|woff2|ttf|eot)$/i,
  /^prisma\/migrations\//,
];

// Files that are low-priority — include only if there's room
const LOW_PRIORITY_PATTERNS = [
  /\.lock$/,
  /\.config\.(js|ts|mjs|cjs)$/,
  /tsconfig.*\.json$/,
  /\.eslintrc/,
  /\.prettierrc/,
  /tailwind\.config/,
  /postcss\.config/,
  /next\.config/,
  /\.env\.example$/,
];

function shouldSkip(filename: string, customIgnore?: string[]): boolean {
  if (SKIP_PATTERNS.some((p) => p.test(filename))) return true;
  if (customIgnore?.length) {
    return customIgnore.some((pattern) => matchGlob(pattern, filename));
  }
  return false;
}

/**
 * Simple glob matcher: supports * (any chars) and ** (any path segments).
 */
function matchGlob(pattern: string, filename: string): boolean {
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "__DOUBLESTAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLESTAR__/g, ".*");
  return new RegExp(`^${regexStr}$`).test(filename);
}

function isLowPriority(filename: string): boolean {
  return LOW_PRIORITY_PATTERNS.some((p) => p.test(filename));
}

/**
 * Parse a unified diff string into per-file chunks.
 */
export function parseDiffByFile(rawDiff: string, customIgnore?: string[]): ParsedFile[] {
  const files: ParsedFile[] = [];
  // Split on "diff --git" boundaries
  const chunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    // Extract filename from "a/path b/path"
    const headerMatch = chunk.match(/^a\/(.+?) b\/(.+)/m);
    if (!headerMatch) continue;

    const filename = headerMatch[2];
    if (shouldSkip(filename, customIgnore)) continue;

    let additions = 0;
    let deletions = 0;
    for (const line of chunk.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }

    files.push({
      filename,
      additions,
      deletions,
      content: `diff --git ${chunk}`,
    });
  }

  return files;
}

/**
 * Prepare a filtered and truncated diff for agent consumption.
 * Prioritizes high-value files (source code) over config/lockfiles.
 * Respects a character budget to avoid overwhelming the model.
 */
export function prepareDiffForAgents(
  rawDiff: string,
  maxChars: number = 30000,
  customIgnore?: string[]
): { diff: string; filesSummary: string; totalFiles: number; includedFiles: number } {
  const allFiles = parseDiffByFile(rawDiff, customIgnore);
  const totalFiles = allFiles.length;

  // Sort: high-priority source files first, low-priority config files last
  const sorted = [...allFiles].sort((a, b) => {
    const aLow = isLowPriority(a.filename) ? 1 : 0;
    const bLow = isLowPriority(b.filename) ? 1 : 0;
    if (aLow !== bLow) return aLow - bLow;
    // Within same priority, sort by change size (more changes = more interesting)
    return (b.additions + b.deletions) - (a.additions + a.deletions);
  });

  let budget = maxChars;
  const included: ParsedFile[] = [];
  const excluded: string[] = [];

  for (const file of sorted) {
    if (file.content.length <= budget) {
      included.push(file);
      budget -= file.content.length;
    } else if (budget > 2000) {
      // Include truncated version of large files
      included.push({
        ...file,
        content: file.content.slice(0, budget - 100) + "\n... (truncated)",
      });
      budget = 0;
    } else {
      excluded.push(file.filename);
    }
  }

  const filesSummary = [
    `Files changed: ${totalFiles} total, ${included.length} included in review`,
    ...included.map((f) => `  \u2714 ${f.filename} (+${f.additions}/-${f.deletions})`),
    ...excluded.map((f) => `  \u2716 ${f} (excluded — budget exceeded)`),
  ].join("\n");

  return {
    diff: included.map((f) => f.content).join("\n"),
    filesSummary,
    totalFiles,
    includedFiles: included.length,
  };
}

/**
 * Get only the filenames that were changed in the diff.
 */
export function getChangedFilenames(rawDiff: string): string[] {
  return parseDiffByFile(rawDiff).map((f) => f.filename);
}

/**
 * Generate a fast hash of the diff content for dedup.
 */
export function hashDiff(diff: string): string {
  let hash = 0;
  for (let i = 0; i < diff.length; i++) {
    const chr = diff.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Calculate a PR complexity score (0–100) based on multiple signals.
 */
export function calculateComplexityScore(rawDiff: string): {
  score: number;
  level: "trivial" | "small" | "moderate" | "complex" | "massive";
  breakdown: { files: number; additions: number; deletions: number; hotspotFiles: number };
} {
  const files = parseDiffByFile(rawDiff);
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const totalChanges = totalAdditions + totalDeletions;
  const fileCount = files.length;

  // Hotspot detection: files with lots of logic changes
  const HOTSPOT_PATTERNS = [/\.ts$/, /\.tsx$/, /\.js$/, /\.jsx$/, /\.py$/, /\.go$/, /\.rs$/];
  const hotspotFiles = files.filter(
    (f) => HOTSPOT_PATTERNS.some((p) => p.test(f.filename)) && (f.additions + f.deletions) > 20
  ).length;

  // Scoring: weighted formula
  let score = 0;
  score += Math.min(fileCount * 5, 30);        // Files: 0-30 points
  score += Math.min(totalChanges * 0.05, 35);   // Lines: 0-35 points
  score += Math.min(hotspotFiles * 10, 25);      // Hotspots: 0-25 points
  score += totalDeletions > totalAdditions * 2 ? 5 : 0;  // Major refactor: +5
  score += fileCount > 10 ? 5 : 0;              // Wide PR: +5
  score = Math.min(Math.round(score), 100);

  const level: "trivial" | "small" | "moderate" | "complex" | "massive" =
    score <= 10 ? "trivial" :
    score <= 25 ? "small" :
    score <= 50 ? "moderate" :
    score <= 75 ? "complex" : "massive";

  return {
    score,
    level,
    breakdown: { files: fileCount, additions: totalAdditions, deletions: totalDeletions, hotspotFiles },
  };
}
