"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { getReviewById, retriggerReview } from "@/module/review/action";
import { createAutoFixPR } from "@/module/review/action/autofix";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft, GitPullRequest, ExternalLink, ShieldAlert, Zap,
  BrainCircuit, Paintbrush, Clock, CheckCircle2, XCircle,
  Loader2, SkipForward, RotateCw, FileCode2, AlertTriangle,
  ChevronDown, ChevronRight, Timer, Hash, TrendingUp, Wrench,
} from "lucide-react";
import { ReviewProgress } from "@/components/review-progress";

const agentConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; gradient: string; label: string }> = {
  security: { icon: <ShieldAlert className="w-4 h-4" />, color: "text-red-400", bg: "bg-red-500/10", gradient: "from-red-500/20 to-transparent", label: "Security" },
  performance: { icon: <Zap className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/10", gradient: "from-yellow-500/20 to-transparent", label: "Performance" },
  logic: { icon: <BrainCircuit className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/10", gradient: "from-blue-500/20 to-transparent", label: "Logic" },
  style: { icon: <Paintbrush className="w-4 h-4" />, color: "text-purple-400", bg: "bg-purple-500/10", gradient: "from-purple-500/20 to-transparent", label: "Style" },
};

const severityConfig: Record<string, { color: string; dot: string; border: string; bg: string; ring: string }> = {
  critical: { color: "text-red-400", dot: "bg-red-500", border: "border-l-red-500", bg: "bg-red-500/5", ring: "ring-red-500/20" },
  high: { color: "text-orange-400", dot: "bg-orange-500", border: "border-l-orange-500", bg: "bg-orange-500/5", ring: "ring-orange-500/20" },
  medium: { color: "text-yellow-400", dot: "bg-yellow-500", border: "border-l-yellow-500", bg: "bg-yellow-500/5", ring: "ring-yellow-500/20" },
  low: { color: "text-blue-400", dot: "bg-blue-500", border: "border-l-blue-500", bg: "bg-blue-500/5", ring: "ring-blue-500/20" },
  info: { color: "text-zinc-400", dot: "bg-zinc-500", border: "border-l-zinc-500", bg: "bg-zinc-500/5", ring: "ring-zinc-500/20" },
};

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, label: "Pending", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" },
  in_progress: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: "In Progress", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, label: "Failed", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  skipped: { icon: <SkipForward className="w-3.5 h-3.5" />, label: "Skipped", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
};

function formatDuration(ms: number | null): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// Markdown renderer
function ReviewMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div key={key++} className="my-4 rounded-xl overflow-hidden border border-border/60 shadow-sm">
            {codeLang && (
              <div className="px-4 py-2 bg-muted/60 text-[11px] text-muted-foreground font-mono uppercase tracking-wider border-b border-border/60 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="ml-2">{codeLang}</span>
              </div>
            )}
            <pre className="p-4 bg-[#0d1117] overflow-x-auto text-[13px] font-mono leading-6">
              <code className="text-[#e6edf3]">{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeLines = [];
        codeLang = "";
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("#### ")) {
      elements.push(<h4 key={key++} className="text-[15px] font-semibold text-foreground mt-6 mb-2">{renderInline(line.slice(5))}</h4>);
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-lg font-bold text-foreground mt-8 mb-3 flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-violet-500" />
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={key++} className="text-xl font-bold text-foreground mt-8 mb-4 pb-3 border-b border-border/60">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={key++} className="border-l-4 border-violet-500/50 pl-4 py-2.5 my-4 bg-gradient-to-r from-violet-500/5 to-transparent rounded-r-lg text-sm text-muted-foreground italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={key++} className="my-6 border-border/40" />);
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={key++} className="flex gap-3 my-2 text-sm text-muted-foreground pl-1">
          <span className="text-violet-400 font-mono font-bold shrink-0 min-w-[20px]">{line.match(/^(\d+\.)/)?.[1]}</span>
          <span className="leading-relaxed">{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={key++} className="flex gap-2.5 my-1.5 text-sm text-muted-foreground pl-3">
          <span className="text-violet-400/80 mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400/60" />
          <span className="leading-relaxed">{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-3" />);
    } else {
      elements.push(<p key={key++} className="text-sm text-muted-foreground leading-7 my-1">{renderInline(line)}</p>);
    }
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={idx++} className="text-foreground font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) parts.push(remaining.slice(0, codeMatch.index));
      parts.push(<code key={idx++} className="px-1.5 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded text-[12px] font-mono text-violet-300">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }
    parts.push(remaining);
    break;
  }

  return <>{parts}</>;
}

// Finding card with expand/collapse
function FindingCard({ finding }: { finding: { id: string; title: string; severity: string; confidence: number; file: string; description: string; suggestion: string } }) {
  const [expanded, setExpanded] = React.useState(false);
  const sev = severityConfig[finding.severity] || severityConfig.info;

  return (
    <div className={`border-l-4 ${sev.border} transition-all duration-200 ${expanded ? sev.bg : "hover:bg-muted/30"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-3"
      >
        <div className="pt-0.5 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground truncate">{finding.title}</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.color} ${sev.ring} ring-1 inline-flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
              {finding.severity.toUpperCase()}
            </span>
            <span className="text-[10px] text-muted-foreground/70 ml-auto shrink-0">
              {(finding.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <FileCode2 className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-[11px] font-mono text-muted-foreground/80 truncate">{finding.file}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pl-12 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[13px] text-muted-foreground leading-relaxed">{finding.description}</p>
          {finding.suggestion && (
            <div className="rounded-xl overflow-hidden border border-emerald-500/20">
              <div className="px-3 py-1.5 bg-emerald-500/5 border-b border-emerald-500/20 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Suggested Fix</span>
              </div>
              <pre className="p-4 bg-[#0d1117] text-[13px] text-emerald-300/90 font-mono whitespace-pre-wrap leading-6 overflow-x-auto">{finding.suggestion}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reviewId = params.id as string;
  const [retriggering, setRetriggering] = React.useState(false);
  const [autofixing, setAutofixing] = React.useState(false);
  const [autofixResult, setAutofixResult] = React.useState<{ prUrl: string; filesFixed: number } | null>(null);
  const [activeTab, setActiveTab] = React.useState<"review" | "findings">("review");

  const { data: review, isLoading } = useQuery({
    queryKey: ["review", reviewId],
    queryFn: () => getReviewById(reviewId),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "in_progress" || data?.status === "pending" ? 3000 : false;
    },
  });

  const handleRetrigger = async () => {
    try {
      setRetriggering(true);
      await retriggerReview(reviewId);
    } catch (e) {
      console.error("Failed to retrigger:", e);
    } finally {
      setRetriggering(false);
    }
  };

  const handleAutoFix = async () => {
    try {
      setAutofixing(true);
      setAutofixResult(null);
      const result = await createAutoFixPR(reviewId);
      setAutofixResult({ prUrl: result.prUrl, filesFixed: result.filesFixed });
    } catch (e: any) {
      console.error("Auto-fix failed:", e);
      alert(e.message || "Auto-fix failed");
    } finally {
      setAutofixing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-foreground font-medium">Review not found</p>
          <p className="text-sm text-muted-foreground mt-1">This review may have been deleted.</p>
        </div>
        <button onClick={() => router.push("/dashboard/reviews")} className="text-violet-400 text-sm hover:underline mt-2">
          Back to reviews
        </button>
      </div>
    );
  }

  const findings = review.findings || [];
  const st = statusConfig[review.status] || statusConfig.completed;
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;

  // Group findings by agent
  const findingsByAgent: Record<string, typeof findings> = {};
  for (const f of findings) {
    if (!findingsByAgent[f.agentName]) findingsByAgent[f.agentName] = [];
    findingsByAgent[f.agentName].push(f);
  }

  // Unique files affected
  const uniqueFiles = [...new Set(findings.map((f) => f.file))];

  return (
    <div className="space-y-6 pb-12">
      {/* Back nav */}
      <button
        onClick={() => router.push("/dashboard/reviews")}
        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>All Reviews</span>
      </button>

      {/* Hero header */}
      <div className="relative overflow-hidden bg-card border border-border rounded-2xl">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />

        <div className="p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="space-y-4 min-w-0">
              {/* Meta row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground bg-muted/50 px-2.5 py-1 rounded-md">{review.repository.fullName}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-bold ${st.color} ${st.bg}`}>
                  {st.icon} {st.label}
                </span>
                {review.durationMs && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="w-3.5 h-3.5" /> {formatDuration(review.durationMs)}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-start gap-3 leading-tight">
                <GitPullRequest className="w-7 h-7 text-violet-400 shrink-0 mt-1" />
                <span className="break-words">{review.prTitle}</span>
              </h1>

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground">
                Reviewed {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                {review.createdAt && <span className="text-muted-foreground/50"> &mdash; {format(new Date(review.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {findings.length > 0 && review.status === "completed" && (
                <button
                  onClick={handleAutoFix}
                  disabled={autofixing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-emerald-500/20"
                >
                  <Wrench className={`w-3.5 h-3.5 ${autofixing ? "animate-bounce" : ""}`} />
                  {autofixing ? "Creating PR..." : "Auto-Fix"}
                </button>
              )}
              <button
                onClick={handleRetrigger}
                disabled={retriggering}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-violet-500/20"
              >
                <RotateCw className={`w-3.5 h-3.5 ${retriggering ? "animate-spin" : ""}`} />
                {retriggering ? "Running..." : "Re-run"}
              </button>
              <a
                href={review.prUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-card border border-border text-foreground text-xs px-4 py-2.5 rounded-lg font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                GitHub <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-border/60">
            {[
              { label: "Critical", count: criticalCount, color: "text-red-400", dotColor: "bg-red-500" },
              { label: "High", count: highCount, color: "text-orange-400", dotColor: "bg-orange-500" },
              { label: "Medium", count: mediumCount, color: "text-yellow-400", dotColor: "bg-yellow-500" },
              { label: "Low", count: lowCount, color: "text-blue-400", dotColor: "bg-blue-500" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
                <div className={`w-2 h-2 rounded-full ${s.dotColor}`} />
                <div>
                  <div className={`text-lg font-bold ${s.color} leading-none`}>{s.count}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              <div>
                <div className="text-lg font-bold text-foreground leading-none">{findings.length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Total</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <div>
                <div className="text-lg font-bold text-foreground leading-none">{uniqueFiles.length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Files</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-fix success banner */}
      {autofixResult && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-400">Auto-Fix PR Created</p>
            <p className="text-xs text-muted-foreground mt-0.5">Fixed {autofixResult.filesFixed} file{autofixResult.filesFixed !== 1 ? "s" : ""}. Review the changes before merging.</p>
          </div>
          <a
            href={autofixResult.prUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shrink-0"
          >
            View Fix PR <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Progress tracker for in-progress reviews */}
      {(review.status === "in_progress" || review.status === "pending") && (
        <ReviewProgress currentStep={(review as any).currentStep} />
      )}

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2 -mx-1 px-1">
        <div className="flex gap-1 bg-muted/60 p-1 rounded-xl w-fit border border-border/40">
          {(["review", "findings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "review" ? "Full Review" : `Findings (${findings.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "review" ? (
        <div className="bg-card border border-border rounded-2xl p-6 md:p-10 shadow-sm">
          {review.review ? (
            <article className="max-w-none prose-sm">
              <ReviewMarkdown content={review.review} />
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="relative w-14 h-14 mb-5">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              </div>
              <p className="font-medium text-foreground">Review in progress</p>
              <p className="text-sm mt-1">Our AI agents are analyzing your code changes...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Agent breakdown */}
          {Object.entries(findingsByAgent).map(([agent, agentFindings]) => {
            const ac = agentConfig[agent] || agentConfig.logic;
            return (
              <div key={agent} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {/* Agent header with gradient */}
                <div className={`px-5 py-4 flex items-center gap-3 bg-gradient-to-r ${ac.gradient}`}>
                  <div className={`w-9 h-9 rounded-xl ${ac.bg} flex items-center justify-center ${ac.color} ring-1 ${ac.color === "text-red-400" ? "ring-red-500/20" : ac.color === "text-yellow-400" ? "ring-yellow-500/20" : ac.color === "text-blue-400" ? "ring-blue-500/20" : "ring-purple-500/20"}`}>
                    {ac.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{ac.label} Agent</h3>
                    <p className="text-[11px] text-muted-foreground">{agentFindings.length} finding{agentFindings.length !== 1 ? "s" : ""} detected</p>
                  </div>
                </div>
                {/* Findings list */}
                <div className="divide-y divide-border/50">
                  {agentFindings.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))}
                </div>
              </div>
            );
          })}

          {findings.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">All Clear</h3>
              <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
                No issues were found in this pull request. Your code looks great!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
