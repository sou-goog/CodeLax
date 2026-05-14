"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { getReviewById, retriggerReview } from "@/module/review/action";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, GitPullRequest, ExternalLink, ShieldAlert, Zap,
  BrainCircuit, Paintbrush, Clock, CheckCircle2, XCircle,
  Loader2, SkipForward, RotateCw, FileCode2, AlertTriangle,
} from "lucide-react";
import { ReviewProgress } from "@/components/review-progress";

const agentConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  security: { icon: <ShieldAlert className="w-4 h-4" />, color: "text-red-400", bg: "bg-red-500/20", label: "Security" },
  performance: { icon: <Zap className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Performance" },
  logic: { icon: <BrainCircuit className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/20", label: "Logic" },
  style: { icon: <Paintbrush className="w-4 h-4" />, color: "text-purple-400", bg: "bg-purple-500/20", label: "Style" },
};

const severityConfig: Record<string, { color: string; dot: string; border: string; bg: string }> = {
  critical: { color: "text-red-400", dot: "bg-red-500", border: "border-l-red-500", bg: "bg-red-500/5" },
  high: { color: "text-orange-400", dot: "bg-orange-500", border: "border-l-orange-500", bg: "bg-orange-500/5" },
  medium: { color: "text-yellow-400", dot: "bg-yellow-500", border: "border-l-yellow-500", bg: "bg-yellow-500/5" },
  low: { color: "text-blue-400", dot: "bg-blue-500", border: "border-l-blue-500", bg: "bg-blue-500/5" },
  info: { color: "text-zinc-400", dot: "bg-zinc-500", border: "border-l-zinc-500", bg: "bg-zinc-500/5" },
};

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  pending: { icon: <Clock className="w-4 h-4" />, label: "Pending", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" },
  in_progress: { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: "In Progress", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  completed: { icon: <CheckCircle2 className="w-4 h-4" />, label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  failed: { icon: <XCircle className="w-4 h-4" />, label: "Failed", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  skipped: { icon: <SkipForward className="w-4 h-4" />, label: "Skipped", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
};

function formatDuration(ms: number | null): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// Simple markdown renderer for review content
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
          <div key={key++} className="my-3 rounded-lg overflow-hidden border border-border">
            {codeLang && (
              <div className="px-3 py-1.5 bg-muted/80 text-[10px] text-muted-foreground font-mono uppercase tracking-wider border-b border-border">
                {codeLang}
              </div>
            )}
            <pre className="p-4 bg-muted/40 overflow-x-auto text-sm font-mono leading-relaxed">
              <code>{codeLines.join("\n")}</code>
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
      elements.push(<h4 key={key++} className="text-base font-bold text-foreground mt-5 mb-2">{line.slice(5)}</h4>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={key++} className="text-lg font-bold text-foreground mt-6 mb-3 pb-2 border-b border-border">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={key++} className="text-xl font-bold text-foreground mt-6 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={key++} className="border-l-4 border-violet-500/40 pl-4 py-2 my-3 bg-violet-500/5 rounded-r-lg text-sm text-muted-foreground">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={key++} className="my-4 border-border" />);
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={key++} className="flex gap-3 my-1.5 text-sm text-muted-foreground">
          <span className="text-violet-400 font-bold shrink-0">{line.match(/^(\d+\.)/)?.[1]}</span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={key++} className="flex gap-2 my-1 text-sm text-muted-foreground ml-2">
          <span className="text-violet-400 mt-1.5 shrink-0">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(<p key={key++} className="text-sm text-muted-foreground leading-relaxed my-1">{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={idx++} className="text-foreground font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) parts.push(remaining.slice(0, codeMatch.index));
      parts.push(<code key={idx++} className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-violet-300">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }
    parts.push(remaining);
    break;
  }

  return <>{parts}</>;
}

export default function ReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reviewId = params.id as string;
  const [retriggering, setRetriggering] = React.useState(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Review not found</p>
        <button onClick={() => router.push("/dashboard/reviews")} className="text-violet-400 text-sm hover:underline">
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

  return (
    <div className="space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard/reviews")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to reviews
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground">{review.repository.fullName}</span>
              <span>·</span>
              {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
              <span>·</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.color} ${st.bg}`}>
                {st.icon} {st.label}
              </span>
              {review.durationMs && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(review.durationMs)}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <GitPullRequest className="w-6 h-6 text-violet-400 shrink-0" />
              {review.prTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRetrigger}
              disabled={retriggering}
              className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs px-4 py-2 rounded-lg font-medium hover:bg-violet-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${retriggering ? "animate-spin" : ""}`} />
              {retriggering ? "Re-running..." : "Re-run Review"}
            </button>
            <a
              href={review.prUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-muted border border-border text-foreground text-xs px-4 py-2 rounded-lg font-medium hover:border-violet-500/30 transition-colors flex items-center gap-2"
            >
              View PR <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 mt-5 flex-wrap">
          {[
            { label: "Critical", count: criticalCount, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "High", count: highCount, color: "text-orange-400", bg: "bg-orange-500/10" },
            { label: "Medium", count: mediumCount, color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { label: "Low", count: lowCount, color: "text-blue-400", bg: "bg-blue-500/10" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-lg px-4 py-2 text-center min-w-[80px]`}>
              <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</div>
            </div>
          ))}
          <div className="bg-muted/50 rounded-lg px-4 py-2 text-center min-w-[80px]">
            <div className="text-xl font-bold text-foreground">{findings.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total</div>
          </div>
        </div>
      </div>

      {/* Progress tracker for in-progress reviews */}
      {(review.status === "in_progress" || review.status === "pending") && (
        <ReviewProgress currentStep={(review as any).currentStep} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {(["review", "findings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "review" ? "Full Review" : `Findings (${findings.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "review" ? (
        <div className="bg-card border border-border rounded-xl p-6 md:p-8">
          {review.review ? (
            <ReviewMarkdown content={review.review} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Review is being generated...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* By agent breakdown */}
          {Object.entries(findingsByAgent).map(([agent, agentFindings]) => {
            const ac = agentConfig[agent] || agentConfig.logic;
            return (
              <div key={agent} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${ac.bg} flex items-center justify-center ${ac.color}`}>
                    {ac.icon}
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{ac.label} Agent</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{agentFindings.length} finding{agentFindings.length !== 1 ? "s" : ""}</span>
                </div>
                {agentFindings.map((finding) => {
                  const sev = severityConfig[finding.severity] || severityConfig.info;
                  return (
                    <div key={finding.id} className={`border-b border-border/50 border-l-4 ${sev.border} p-5 hover:${sev.bg} transition-colors`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <h4 className="text-sm font-bold text-foreground">{finding.title}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold ${sev.color} flex items-center gap-1`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                              {finding.severity.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {(finding.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{finding.file}</span>
                        </div>
                        <p className="text-[13px] text-muted-foreground leading-relaxed">{finding.description}</p>
                        {finding.suggestion && (
                          <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                            <p className="text-[10px] text-violet-400 uppercase tracking-wider font-bold mb-2">Suggested Fix</p>
                            <pre className="text-[13px] text-violet-300 font-mono whitespace-pre-wrap">{finding.suggestion}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {findings.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">All Clear</h3>
              <p className="text-muted-foreground text-sm">No issues found in this review.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
