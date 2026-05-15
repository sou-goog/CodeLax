"use client"
import React from 'react'
import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from
"recharts"
import {Code, Bug, Timer, Zap, Grid3X3, BrainCircuit, AlertTriangle, CheckCircle2, XCircle, Clock, Loader2, Users, FolderOpen, TrendingUp, TrendingDown, ArrowRight} from "lucide-react"
import {useQuery} from "@tanstack/react-query"
import {getDashboardStats , getMonthlyActivity, getDashboardOverview} from "@/module/dashboard/actions";
import ContributionGraph from '@/module/dashboard/actions/components/contribution-graph'
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  completed: { icon: <CheckCircle2 className="w-3 h-3" />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  failed: { icon: <XCircle className="w-3 h-3" />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  in_progress: { icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  pending: { icon: <Clock className="w-3 h-3" />, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
};

const sevColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

const MainPage = () => {
  const {data:stats , isLoading} = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn:async () =>await getDashboardStats(),
    refetchOnWindowFocus:false,
  })
  const {data:monthlyActivity , isLoading:isLoadingActivity} = useQuery({
    queryKey: ["monthly-activity"],
    queryFn:async () =>await getMonthlyActivity(),
    refetchOnWindowFocus:false,
  })
  const {data: overview} = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => getDashboardOverview(),
    refetchOnWindowFocus: false,
  })

  return (
    <div className='space-y-6 pb-12'>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-1">Developer Dashboard</h1>
          <p className="text-muted-foreground">Monitoring performance across your active repositories.</p>
        </div>
        {overview?.trend && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
            {overview.trend.change >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm text-muted-foreground">This week:</span>
            <span className="text-sm font-bold text-foreground">{overview.trend.thisWeek} reviews</span>
            {overview.trend.change !== 0 && (
              <span className={`text-xs font-medium ${overview.trend.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {overview.trend.change > 0 ? "+" : ""}{overview.trend.change}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Code className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1">TOTAL COMMITS</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : (stats?.totalCommits || 0).toLocaleString()}</span>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Bug className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1">REPOSITORIES</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : stats?.totalRepos || 0}</span>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Timer className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1">PULL REQUESTS</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : stats?.totalPRs || 0}</span>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-violet-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-violet-400" />
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1">AI REVIEWS</span>
          <span className="text-[30px] font-semibold text-foreground">{isLoading ? "..." : stats?.totalReviews || 0}</span>
        </div>
      </div>

      {/* Recent Reviews + Severity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Reviews */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-violet-400" />
              Recent Reviews
            </h3>
            <Link href="/dashboard/reviews" className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!overview?.recentReviews?.length ? (
            <div className="px-5 py-12 text-center">
              <BrainCircuit className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No reviews yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {overview.recentReviews.map((review: any) => {
                const sc = statusConfig[review.status] || statusConfig.pending;
                return (
                  <Link
                    key={review.id}
                    href={`/dashboard/reviews/${review.id}`}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg border ${sc.bg} ${sc.color}`}>
                      {sc.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{review.prTitle || "Untitled"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {review.repository.fullName} · {review._count.findings} finding{review._count.findings !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Severity Breakdown (30 days) */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Findings (30d)
          </h3>
          {overview?.severitySummary ? (
            <div className="space-y-3">
              {Object.entries(overview.severitySummary)
                .filter(([, count]) => (count as number) > 0)
                .sort((a, b) => {
                  const order = ["critical", "high", "medium", "low"];
                  return order.indexOf(a[0]) - order.indexOf(b[0]);
                })
                .map(([severity, count]) => {
                  const total = Object.values(overview.severitySummary).reduce((a: number, b: any) => a + b, 0) || 1;
                  return (
                    <div key={severity} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase w-14 text-muted-foreground capitalize">{severity}</span>
                      <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                        <div className={`${sevColors[severity] || "bg-zinc-500"} h-full rounded-full transition-all`} style={{ width: `${((count as number) / total) * 100}%`, minWidth: "6px" }} />
                      </div>
                      <span className="text-xs font-bold text-foreground w-6 text-right">{count as number}</span>
                    </div>
                  );
                })}
              {Object.values(overview.severitySummary).every((c: any) => c === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No findings in the last 30 days!</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          )}

          {/* Teams quick view */}
          {overview?.teams && overview.teams.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-pink-400" />
                Your Teams
              </h3>
              <div className="space-y-2">
                {overview.teams.map((team: any) => (
                  <Link
                    key={team.id}
                    href={`/dashboard/teams/${team.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 font-bold text-[10px] border border-violet-500/20">
                      {team.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{team.name}</p>
                      <p className="text-[10px] text-muted-foreground">{team.members} members · {team.repos} repos</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground capitalize">{team.role}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contribution Graph */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-medium text-foreground flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-violet-400" />
            Contribution Graph
          </h3>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-sm bg-zinc-800"></div>
            <div className="w-3 h-3 rounded-sm bg-violet-900/40"></div>
            <div className="w-3 h-3 rounded-sm bg-violet-700/60"></div>
            <div className="w-3 h-3 rounded-sm bg-violet-500"></div>
          </div>
        </div>
        <div className="p-6">
          <ContributionGraph />
        </div>
      </section>

      {/* Activity Chart */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-xl font-medium text-foreground">Activity Overview</h3>
        </div>
        <div className="p-6">
          {isLoadingActivity ? (
            <div className="h-[300px] w-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyActivity || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend />
                  <Bar dataKey="commits" name="Commits" fill="#7c3aed" radius={[4,4,0,0]} barSize={52}/>
                  <Bar dataKey="prs" name="Pull Requests" fill="#8b5cf6" radius={[4,4,0,0]} barSize={52}/>
                  <Bar dataKey="reviews" name="AI Reviews" fill="#10b981" radius={[4,4,0,0]} barSize={52}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default MainPage