"use client";

import React from 'react';
import { getReviews, retriggerReview } from "@/module/review/action";
import {
  GitPullRequest, ExternalLink, ShieldAlert, Zap, BrainCircuit,
  Paintbrush, Calendar, RotateCw, Clock, CheckCircle2, XCircle,
  Loader2, SkipForward, Search, SlidersHorizontal, ArrowUpDown, X,
} from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ReviewProgress } from "@/components/review-progress";
import Link from "next/link";

interface ReviewFinding {
  id: string;
  agentName: string;
  severity: string;
  confidence: number;
  file: string;
  title: string;
  description: string;
  suggestion: string;
}

interface Review {
  id: string;
  prTitle: string;
  prUrl: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  repository: { fullName: string };
  findings: ReviewFinding[];
}

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

const agentConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  security: { icon: <ShieldAlert className="w-4 h-4" />, color: "text-red-400", bg: "bg-red-500/20" },
  performance: { icon: <Zap className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/20" },
  logic: { icon: <BrainCircuit className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/20" },
  style: { icon: <Paintbrush className="w-4 h-4" />, color: "text-purple-400", bg: "bg-purple-500/20" },
};

const severityConfig: Record<string, { color: string; dot: string; border: string }> = {
  critical: { color: "text-red-400", dot: "bg-red-500", border: "border-l-red-500" },
  high: { color: "text-orange-400", dot: "bg-orange-500", border: "border-l-orange-500" },
  medium: { color: "text-yellow-400", dot: "bg-yellow-500", border: "border-l-yellow-500" },
  low: { color: "text-blue-400", dot: "bg-blue-500", border: "border-l-blue-500" },
  info: { color: "text-zinc-400", dot: "bg-zinc-500", border: "border-l-zinc-500" },
};

type SortKey = "newest" | "oldest" | "most-findings" | "severity";

export default function ReviewsPage() {
  const router = useRouter();
  const [retriggeringId, setRetriggeringId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [repoFilter, setRepoFilter] = React.useState<string>("all");
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<SortKey>("newest");
  const [showFilters, setShowFilters] = React.useState(false);

  const { data: reviews = [], isLoading, refetch } = useQuery<Review[]>({
    queryKey: ["reviews"],
    queryFn: async () => await getReviews() as unknown as Review[],
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data as Review[] | undefined;
      const hasInProgress = data?.some((r) => r.status === "in_progress" || r.status === "pending");
      return hasInProgress ? 5000 : false;
    },
  });

  const handleRetrigger = async (reviewId: string) => {
    try {
      setRetriggeringId(reviewId);
      await retriggerReview(reviewId);
      await refetch();
    } catch (e) {
      console.error("Failed to retrigger review:", e);
    } finally {
      setRetriggeringId(null);
    }
  };

  // Derive unique repos for filter dropdown
  const uniqueRepos = [...new Set(reviews.map((r) => r.repository.fullName))];

  // Apply filters
  const filtered = React.useMemo(() => {
    let result = reviews;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.prTitle.toLowerCase().includes(q) ||
          r.repository.fullName.toLowerCase().includes(q) ||
          r.findings.some(
            (f) =>
              f.title.toLowerCase().includes(q) ||
              f.file.toLowerCase().includes(q) ||
              f.description.toLowerCase().includes(q)
          )
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Repo filter
    if (repoFilter !== "all") {
      result = result.filter((r) => r.repository.fullName === repoFilter);
    }

    // Severity filter — show reviews that have at least one finding of that severity
    if (severityFilter !== "all") {
      result = result.filter((r) =>
        r.findings.some((f) => f.severity === severityFilter)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "most-findings":
          return b.findings.length - a.findings.length;
        case "severity": {
          const weight = (f: ReviewFinding[]) =>
            f.reduce((s, x) => {
              const w: Record<string, number> = { critical: 100, high: 50, medium: 20, low: 5, info: 1 };
              return s + (w[x.severity] || 0);
            }, 0);
          return weight(b.findings) - weight(a.findings);
        }
        default:
          return 0;
      }
    });

    return result;
  }, [reviews, searchQuery, statusFilter, repoFilter, severityFilter, sortBy]);

  const activeFilterCount = [statusFilter !== "all", repoFilter !== "all", severityFilter !== "all"].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all");
    setRepoFilter("all");
    setSeverityFilter("all");
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">AI Reviews</h1>
          <p className="text-muted-foreground">Detailed findings from your multi-agent review pipeline.</p>
        </div>
        <Link
          href="/dashboard/reviews/compare"
          className="bg-card border border-border hover:border-violet-500/40 text-sm px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-muted-foreground hover:text-foreground shrink-0 mt-2"
        >
          <ArrowUpDown className="w-4 h-4 text-violet-400" />
          Compare Reviews
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by PR title, repo, file, or finding..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              showFilters || activeFilterCount > 0
                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-violet-500/30"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="appearance-none bg-card border border-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="most-findings">Most findings</option>
              <option value="severity">Highest severity</option>
            </select>
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="flex gap-2 flex-wrap items-center animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>

            {/* Repo */}
            <select
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
            >
              <option value="all">All repos</option>
              {uniqueRepos.map((repo) => (
                <option key={repo} value={repo}>{repo}</option>
              ))}
            </select>

            {/* Severity */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        {(searchQuery || activeFilterCount > 0) && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {reviews.length} review{reviews.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
          <GitPullRequest className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No reviews yet</h3>
          <p className="text-muted-foreground mb-4">Connect a repository and open a PR to trigger an AI review.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
          <Search className="w-10 h-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No matching reviews</h3>
          <p className="text-muted-foreground text-sm mb-4">Try adjusting your search or filters.</p>
          <button onClick={clearFilters} className="text-violet-400 text-sm hover:underline">Clear all filters</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((review) => {
            const findings = review.findings || [];
            const criticalCount = findings.filter((f) => f.severity === 'critical').length;
            const highCount = findings.filter((f) => f.severity === 'high').length;

            return (
              <div
                key={review.id}
                className="bg-card border border-border rounded-2xl overflow-hidden hover:border-violet-500/20 transition-all group"
              >
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center text-xs text-muted-foreground mb-2 gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{review.repository.fullName}</span>
                      <span>·</span>
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      <span>·</span>
                      {(() => {
                        const st = statusConfig[review.status] || statusConfig.completed;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.color} ${st.bg}`}>
                            {st.icon} {st.label}
                          </span>
                        );
                      })()}
                      {review.durationMs && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(review.durationMs)}</span>
                        </>
                      )}
                      {findings.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-medium">{findings.length} finding{findings.length !== 1 ? "s" : ""}</span>
                        </>
                      )}
                    </div>
                    <h3
                      onClick={() => router.push(`/dashboard/reviews/${review.id}`)}
                      className="text-base font-bold text-foreground flex items-center gap-2 cursor-pointer hover:text-violet-400 transition-colors truncate"
                    >
                      <GitPullRequest className="w-5 h-5 text-violet-400 shrink-0" />
                      <span className="truncate">{review.prTitle}</span>
                      {criticalCount > 0 && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold border border-red-500/20 shrink-0">
                          {criticalCount} Critical
                        </span>
                      )}
                      {highCount > 0 && (
                        <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-bold border border-orange-500/20 shrink-0">
                          {highCount} High
                        </span>
                      )}
                    </h3>
                    {(review.status === "in_progress" || review.status === "pending") && (
                      <div className="mt-2">
                        <ReviewProgress currentStep={(review as any).currentStep} compact />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRetrigger(review.id)}
                      disabled={retriggeringId === review.id}
                      className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs px-3 py-2 rounded-lg font-medium hover:bg-violet-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCw className={`w-3 h-3 ${retriggeringId === review.id ? 'animate-spin' : ''}`} />
                      {retriggeringId === review.id ? 'Running...' : 'Re-run'}
                    </button>
                    <a
                      href={review.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-muted border border-border text-foreground text-xs px-3 py-2 rounded-lg font-medium hover:border-violet-500/30 transition-colors flex items-center gap-1.5"
                    >
                      PR <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
