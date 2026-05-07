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

function shouldSkip(filename: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(filename));
}

function isLowPriority(filename: string): boolean {
  return LOW_PRIORITY_PATTERNS.some((p) => p.test(filename));
}

/**
 * Parse a unified diff string into per-file chunks.
 */
export function parseDiffByFile(rawDiff: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  // Split on "diff --git" boundaries
  const chunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    // Extract filename from "a/path b/path"
    const headerMatch = chunk.match(/^a\/(.+?) b\/(.+)/m);
    if (!headerMatch) continue;

    const filename = headerMatch[2];
    if (shouldSkip(filename)) continue;

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
  maxChars: number = 30000
): { diff: string; filesSummary: string; totalFiles: number; includedFiles: number } {
  const allFiles = parseDiffByFile(rawDiff);
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
