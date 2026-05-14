"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getReviewsForComparison,
  compareReviews,
  type ReviewComparisonData,
} from "@/module/review/action/compare";
import {
  ArrowLeftRight, ChevronDown, Loader2, CheckCircle2,
  XCircle, Plus, Minus, Equal, TrendingDown, TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

const sevColors: Record<string, { text: string; bg: string; dot: string }> = {
  critical: { text: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
  high: { text: "text-orange-400", bg: "bg-orange-500/10", dot: "bg-orange-500" },
  medium: { text: "text-yellow-400", bg: "bg-yellow-500/10", dot: "bg-yellow-500" },
  low: { text: "text-blue-400", bg: "bg-blue-500/10", dot: "bg-blue-500" },
};

export default function CompareReviewsPage() {
  const router = useRouter();
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [comparison, setComparison] = useState<ReviewComparisonData | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews-for-compare"],
    queryFn: () => getReviewsForComparison(),
  });

  const handleCompare = async () => {
    if (!leftId || !rightId || leftId === rightId) return;
    setLoading(true);
    try {
      const result = await compareReviews(leftId, rightId);
      setComparison(result);
    } catch (e) {
      console.error("Compare failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const improvement = comparison
    ? comparison.left.totalFindings - comparison.right.totalFindings
    : 0;

  return (
    <div className="space-y-6 pb-12">
      <button
        onClick={() => router.push("/dashboard/reviews")}
        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        All Reviews
      </button>

      <div>
        <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2 flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-violet-400" />
          Compare Reviews
        </h1>
        <p className="text-muted-foreground">Track regression or improvement across PR iterations.</p>
      </div>

      {/* Selection */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-2">Baseline (older)</label>
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="">Select a review...</option>
              {reviews.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.repository.fullName} #{r.prNumber} — {r.prTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden md:flex items-center justify-center pb-1">
            <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-2">Current (newer)</label>
            <select
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="">Select a review...</option>
              {reviews.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.repository.fullName} #{r.prNumber} — {r.prTitle}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={!leftId || !rightId || leftId === rightId || loading}
          className="mt-4 bg-violet-600 hover:bg-violet-500 text-white text-sm px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
          {loading ? "Comparing..." : "Compare"}
        </button>
      </div>

      {/* Results */}
      {comparison && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Overview cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Baseline</p>
              <p className="text-2xl font-bold text-foreground">{comparison.left.totalFindings}</p>
              <p className="text-[11px] text-muted-foreground">findings</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Current</p>
              <p className="text-2xl font-bold text-foreground">{comparison.right.totalFindings}</p>
              <p className="text-[11px] text-muted-foreground">findings</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Resolved</p>
              <p className="text-2xl font-bold text-emerald-400">{comparison.resolvedFindings.length}</p>
              <p className="text-[11px] text-muted-foreground">issues fixed</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Trend</p>
              <div className="flex items-center gap-2">
                {improvement > 0 ? (
                  <>
                    <TrendingDown className="w-5 h-5 text-emerald-400" />
                    <span className="text-2xl font-bold text-emerald-400">-{improvement}</span>
                  </>
                ) : improvement < 0 ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-red-400" />
                    <span className="text-2xl font-bold text-red-400">+{Math.abs(improvement)}</span>
                  </>
                ) : (
                  <>
                    <Equal className="w-5 h-5 text-muted-foreground" />
                    <span className="text-2xl font-bold text-muted-foreground">0</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{improvement > 0 ? "improvement" : improvement < 0 ? "regression" : "no change"}</p>
            </div>
          </div>

          {/* Severity trend */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Severity Trend</h3>
            <div className="space-y-3">
              {comparison.severityTrend.map((s) => {
                const sc = sevColors[s.severity] || sevColors.low;
                const diff = s.right - s.left;
                return (
                  <div key={s.severity} className="flex items-center gap-4">
                    <div className="w-20 shrink-0">
                      <span className={`text-xs font-bold capitalize ${sc.text}`}>{s.severity}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground w-6 text-right">{s.left}</span>
                      <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden relative">
                        <div
                          className={`absolute inset-y-0 left-0 ${sc.dot} rounded-full opacity-40`}
                          style={{ width: `${Math.max(s.left, s.right) === 0 ? 0 : (s.left / Math.max(s.left, s.right)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground/50">→</span>
                      <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden relative">
                        <div
                          className={`absolute inset-y-0 left-0 ${sc.dot} rounded-full`}
                          style={{ width: `${Math.max(s.left, s.right) === 0 ? 0 : (s.right / Math.max(s.left, s.right)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-foreground w-6 text-right">{s.right}</span>
                    </div>
                    <span className={`text-xs font-mono w-8 text-right ${diff < 0 ? "text-emerald-400" : diff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {diff > 0 ? `+${diff}` : diff === 0 ? "—" : diff}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Finding diff lists */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Resolved */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-emerald-500/5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">Resolved ({comparison.resolvedFindings.length})</span>
              </div>
              <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
                {comparison.resolvedFindings.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">None resolved</p>
                ) : comparison.resolvedFindings.map((f, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Minus className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="line-through opacity-70">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* New */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-red-500/5">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400">New ({comparison.newFindings.length})</span>
              </div>
              <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
                {comparison.newFindings.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No new issues</p>
                ) : comparison.newFindings.map((f, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Plus className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Persistent */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-yellow-500/5">
                <Equal className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">Persistent ({comparison.persistentFindings.length})</span>
              </div>
              <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
                {comparison.persistentFindings.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No persistent issues</p>
                ) : comparison.persistentFindings.map((f, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Equal className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
