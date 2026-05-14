"use client";

import React from "react";
import { getAnalytics } from "@/module/review/action/analytics";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ShieldAlert,
  Zap,
  BrainCircuit,
  Paintbrush,
  TrendingUp,
  FileWarning,
  FolderGit2,
  Activity,
  Timer,
  AlertTriangle,
  Target,
} from "lucide-react";

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-zinc-500",
};

const agentConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  security: { icon: <ShieldAlert className="w-4 h-4" />, color: "text-red-400", bg: "bg-red-500/10" },
  performance: { icon: <Zap className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  logic: { icon: <BrainCircuit className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/10" },
  style: { icon: <Paintbrush className="w-4 h-4" />, color: "text-purple-400", bg: "bg-purple-500/10" },
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => await getAnalytics(),
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const maxTimelineFindings = Math.max(...data.timeline.map((d) => d.findings), 1);
  const maxFileCount = Math.max(...data.topFiles.map((f) => f.count), 1);
  const totalAgentFindings = Object.values(data.agentDist).reduce((a, b) => a + b, 0) || 1;
  const latestScore = data.weeklyScores.length > 0 ? data.weeklyScores[data.weeklyScores.length - 1].score : null;
  const maxScore = Math.max(...data.weeklyScores.map((w) => w.score), 100);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">Review trends, code quality scores, and improvement insights.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={<Activity className="w-5 h-5 text-violet-400" />} label="Reviews" value={String(data.totalReviews)} />
        <StatCard icon={<FileWarning className="w-5 h-5 text-orange-400" />} label="Findings" value={String(data.totalFindings)} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} label="Avg / PR" value={String(data.avgFindings)} />
        <StatCard icon={<Timer className="w-5 h-5 text-blue-400" />} label="Avg Duration" value={data.avgDuration ? formatMs(data.avgDuration) : "—"} />
        <StatCard icon={<Target className="w-5 h-5 text-violet-400" />} label="Quality Score" value={latestScore !== null ? `${latestScore}/100` : "—"} highlight={latestScore !== null && latestScore >= 70} />
      </div>

      {/* Weekly Quality Trend — visual line chart */}
      {data.weeklyScores.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" /> Code Quality Trend
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Weekly quality score based on finding severity</p>
            </div>
            {latestScore !== null && (
              <div className={`text-3xl font-bold ${latestScore >= 80 ? "text-emerald-400" : latestScore >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                {latestScore}
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="relative h-48">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((v) => (
              <div key={v} className="absolute left-0 right-0 border-t border-border/30" style={{ bottom: `${v}%` }}>
                <span className="absolute -left-1 -translate-x-full text-[10px] text-muted-foreground/60 -top-2">{v}</span>
              </div>
            ))}

            {/* Bars */}
            <div className="absolute inset-0 flex items-end gap-1 px-6">
              {data.weeklyScores.map((week, i) => {
                const height = (week.score / maxScore) * 100;
                const isLatest = i === data.weeklyScores.length - 1;
                const color = week.score >= 80 ? "bg-emerald-500" : week.score >= 60 ? "bg-yellow-500" : "bg-red-500";
                return (
                  <div key={week.week} className="flex-1 flex flex-col items-center group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-card border border-border rounded-md px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                      <span className="font-bold">{week.score}/100</span> · {week.reviews} PRs
                    </div>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${color} ${isLatest ? "opacity-100 ring-2 ring-offset-1 ring-offset-background ring-violet-500/40" : "opacity-70 hover:opacity-100"}`}
                      style={{ height: `${height}%`, minHeight: "4px" }}
                    />
                    <span className="text-[9px] text-muted-foreground mt-1.5 truncate w-full text-center">
                      {week.week.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Timeline + Common Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" /> Activity (Last 30 Days)
          </h2>
          {data.timeline.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No reviews in the last 30 days.</p>
          ) : (
            <div className="relative h-40 flex items-end gap-[2px]">
              {data.timeline.map((day) => {
                const h = (day.findings / maxTimelineFindings) * 100;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center group relative">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded-md px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {day.date.slice(5)} · {day.reviews}r / {day.findings}f
                    </div>
                    <div
                      className="w-full bg-violet-500/80 rounded-t-sm hover:bg-violet-400 transition-colors"
                      style={{ height: `${Math.max(h, 3)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground px-1">
            <span>{data.timeline[0]?.date.slice(5)}</span>
            <span>{data.timeline[data.timeline.length - 1]?.date.slice(5)}</span>
          </div>
        </div>

        {/* Common Issues */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Common Issues
          </h2>
          {data.commonIssues.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No recurring issues found.</p>
          ) : (
            <div className="space-y-2">
              {data.commonIssues.map((issue, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="text-[10px] text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <span className="text-xs text-muted-foreground truncate flex-1 group-hover:text-foreground transition-colors capitalize">
                    {issue.title}
                  </span>
                  <span className="text-[10px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    ×{issue.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-foreground mb-4">Severity Distribution</h2>
          <div className="space-y-3">
            {Object.entries(data.severityDist)
              .filter(([, count]) => count > 0)
              .sort((a, b) => {
                const order = ["critical", "high", "medium", "low", "info"];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
              })
              .map(([severity, count]) => (
                <div key={severity} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase w-14 text-muted-foreground">{severity}</span>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className={`${severityColors[severity]} h-full rounded-full transition-all`}
                      style={{ width: `${(count / data.totalFindings) * 100}%`, minWidth: "6px" }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Agent Distribution */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-foreground mb-4">Findings by Agent</h2>
          <div className="space-y-3">
            {Object.entries(data.agentDist)
              .sort((a, b) => b[1] - a[1])
              .map(([agent, count]) => {
                const cfg = agentConfig[agent] || { icon: null, color: "text-zinc-400", bg: "bg-zinc-500/10" };
                const pct = Math.round((count / totalAgentFindings) * 100);
                return (
                  <div key={agent} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center ${cfg.color} shrink-0`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold capitalize text-foreground">{agent}</span>
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-violet-500 h-full rounded-full transition-all"
                          style={{ width: `${(count / totalAgentFindings) * 100}%`, minWidth: "4px" }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Top Risky Files */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-orange-400" /> Hotspot Files
        </h2>
        {data.topFiles.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No findings yet.</p>
        ) : (
          <div className="space-y-2">
            {data.topFiles.map((file, i) => (
              <div key={file.file} className="flex items-center gap-3 group">
                <span className="text-[10px] font-bold text-muted-foreground w-5">{i + 1}.</span>
                <code className="text-[11px] text-muted-foreground group-hover:text-foreground flex-1 truncate font-mono transition-colors">{file.file}</code>
                <div className="w-24 bg-muted rounded-full h-2 overflow-hidden shrink-0">
                  <div
                    className="bg-orange-500 h-full rounded-full"
                    style={{ width: `${(file.count / maxFileCount) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-foreground w-6 text-right">{file.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-Repo Stats */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-blue-400" /> Repository Breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.repos.map((repo) => (
            <div key={repo.name} className="bg-muted/30 border border-border rounded-xl p-4 hover:border-violet-500/30 transition-colors">
              <h3 className="text-sm font-bold text-foreground truncate">{repo.name}</h3>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{repo.reviews}</span>
                <span className="flex items-center gap-1"><FileWarning className="w-3 h-3" />{repo.findings}</span>
                <span className="text-foreground font-medium ml-auto">
                  {repo.reviews > 0 ? (repo.findings / repo.reviews).toFixed(1) : 0} avg
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${highlight ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-emerald-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
