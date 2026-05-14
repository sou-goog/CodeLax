"use client";

import React, { useState } from "react";
import {
  FileCode2, Plus, Minus, ChevronDown, ChevronRight,
  FileText, FilePlus, FileX, FileEdit, AlertTriangle,
} from "lucide-react";
import type { DiffFile, DiffHunk, DiffLine } from "@/module/review/action/diff";

interface Finding {
  id: string;
  file: string;
  title: string;
  severity: string;
  startLine: number | null;
  endLine: number | null;
  description: string;
}

const statusIcon: Record<string, React.ReactNode> = {
  added: <FilePlus className="w-3.5 h-3.5 text-emerald-400" />,
  removed: <FileX className="w-3.5 h-3.5 text-red-400" />,
  modified: <FileEdit className="w-3.5 h-3.5 text-blue-400" />,
  renamed: <FileText className="w-3.5 h-3.5 text-yellow-400" />,
};

const statusColor: Record<string, string> = {
  added: "text-emerald-400",
  removed: "text-red-400",
  modified: "text-blue-400",
  renamed: "text-yellow-400",
};

const sevDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-zinc-500",
};

const sevBg: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/30",
  high: "bg-orange-500/10 border-orange-500/30",
  medium: "bg-yellow-500/10 border-yellow-500/30",
  low: "bg-blue-500/10 border-blue-500/30",
  info: "bg-zinc-500/10 border-zinc-500/30",
};

export function DiffViewer({
  files,
  findings = [],
}: {
  files: DiffFile[];
  findings?: Finding[];
}) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    new Set(files.slice(0, 3).map((f) => f.filename))
  );

  const toggleFile = (filename: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const expandAll = () => setExpandedFiles(new Set(files.map((f) => f.filename)));
  const collapseAll = () => setExpandedFiles(new Set());

  // Index findings by file for fast lookup
  const findingsByFile: Record<string, Finding[]> = {};
  for (const f of findings) {
    if (!findingsByFile[f.file]) findingsByFile[f.file] = [];
    findingsByFile[f.file].push(f);
  }

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{files.length} file{files.length !== 1 ? "s" : ""} changed</span>
          <span className="text-emerald-400 flex items-center gap-1"><Plus className="w-3 h-3" />{totalAdditions}</span>
          <span className="text-red-400 flex items-center gap-1"><Minus className="w-3 h-3" />{totalDeletions}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Expand all</button>
          <span className="text-muted-foreground/30">|</span>
          <button onClick={collapseAll} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Collapse all</button>
        </div>
      </div>

      {/* File list */}
      {files.map((file) => {
        const expanded = expandedFiles.has(file.filename);
        const fileFindingsCount = (findingsByFile[file.filename] || []).length;

        return (
          <div key={file.filename} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* File header */}
            <button
              onClick={() => toggleFile(file.filename)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="shrink-0 text-muted-foreground">
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
              {statusIcon[file.status] || <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="text-xs font-mono text-foreground truncate flex-1">{file.filename}</span>
              <div className="flex items-center gap-2.5 shrink-0">
                {fileFindingsCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {fileFindingsCount}
                  </span>
                )}
                <span className={`text-[10px] font-medium capitalize ${statusColor[file.status] || "text-muted-foreground"}`}>
                  {file.status}
                </span>
                <span className="text-emerald-400 text-[10px] font-mono">+{file.additions}</span>
                <span className="text-red-400 text-[10px] font-mono">-{file.deletions}</span>
              </div>
            </button>

            {/* Diff content */}
            {expanded && (
              <div className="border-t border-border overflow-x-auto">
                {file.hunks.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">Binary file or no diff available</div>
                ) : (
                  file.hunks.map((hunk, hi) => (
                    <HunkView
                      key={hi}
                      hunk={hunk}
                      findings={findingsByFile[file.filename] || []}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HunkView({ hunk, findings }: { hunk: DiffHunk; findings: Finding[] }) {
  // Build a set of lines that have findings
  const findingsByNewLine: Record<number, Finding[]> = {};
  for (const f of findings) {
    if (f.startLine) {
      if (!findingsByNewLine[f.startLine]) findingsByNewLine[f.startLine] = [];
      findingsByNewLine[f.startLine].push(f);
    }
  }

  return (
    <div>
      {/* Hunk header */}
      <div className="px-4 py-1.5 bg-blue-500/5 text-[11px] font-mono text-blue-400/80 border-b border-border/40 select-none">
        {hunk.header}
      </div>

      {/* Lines */}
      <table className="w-full text-[12px] font-mono leading-5">
        <tbody>
          {hunk.lines.map((line, li) => {
            const lineBg =
              line.type === "add"
                ? "bg-emerald-500/8"
                : line.type === "remove"
                ? "bg-red-500/8"
                : "";

            const lineColor =
              line.type === "add"
                ? "text-emerald-300"
                : line.type === "remove"
                ? "text-red-300"
                : "text-muted-foreground";

            const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

            const lineFindings = line.newLine ? findingsByNewLine[line.newLine] || [] : [];

            return (
              <React.Fragment key={li}>
                <tr className={`${lineBg} hover:bg-muted/20 group`}>
                  {/* Old line number */}
                  <td className="w-[1px] whitespace-nowrap px-2 py-0 text-right text-muted-foreground/40 select-none border-r border-border/20 align-top">
                    {line.oldLine ?? ""}
                  </td>
                  {/* New line number */}
                  <td className="w-[1px] whitespace-nowrap px-2 py-0 text-right text-muted-foreground/40 select-none border-r border-border/20 align-top">
                    {line.newLine ?? ""}
                  </td>
                  {/* Prefix */}
                  <td className={`w-[1px] whitespace-nowrap px-1 py-0 select-none font-bold ${
                    line.type === "add" ? "text-emerald-500" : line.type === "remove" ? "text-red-500" : "text-transparent"
                  }`}>
                    {prefix}
                  </td>
                  {/* Content */}
                  <td className={`py-0 pr-4 whitespace-pre-wrap break-all ${lineColor}`}>
                    {line.content || "\u00A0"}
                  </td>
                </tr>
                {/* Inline finding annotation */}
                {lineFindings.map((finding) => (
                  <tr key={finding.id}>
                    <td colSpan={4} className="px-0 py-0">
                      <div className={`mx-3 my-1.5 px-3 py-2.5 rounded-lg border ${sevBg[finding.severity] || sevBg.info}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${sevDot[finding.severity] || sevDot.info}`} />
                          <span className="text-[11px] font-bold text-foreground">{finding.title}</span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium ml-auto">
                            {finding.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{finding.description}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
