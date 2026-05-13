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
} from "lucide-react";

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-zinc-500",
};

const agentConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  security: { icon: <ShieldAlert className="w-4 h-4" />, color: "text-red-400" },
  performance: { icon: <Zap className="w-4 h-4" />, color: "text-yellow-400" },
  logic: { icon: <BrainCircuit className="w-4 h-4" />, color: "text-blue-400" },
  style: { icon: <Paintbrush className="w-4 h-4" />, color: "text-purple-400" },
};

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => await getAnalytics(),
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxTimelineReviews = Math.max(...data.timeline.map((d) => d.reviews), 1);
  const maxTimelineFindings = Math.max(...data.timeline.map((d) => d.findings), 1);
  const maxFileCount = Math.max(...data.topFiles.map((f) => f.count), 1);
  const totalAgentFindings = Object.values(data.agentDist).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">Review trends, issue distribution, and code health metrics.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Activity className="w-5 h-5 text-violet-400" />} label="Total Reviews" value={data.totalReviews} />
        <StatCard icon={<FileWarning className="w-5 h-5 text-orange-400" />} label="Total Findings" value={data.totalFindings} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} label="Avg Findings/PR" value={data.avgFindings} />
        <StatCard icon={<FolderGit2 className="w-5 h-5 text-blue-400" />} label="Repositories" value={data.repos.length} />
      </div>

      {/* Timeline Chart */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-400" /> Review Activity (Last 30 Days)
        </h2>
        {data.timeline.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reviews in the last 30 days.</p>
        ) : (
          <div className="space-y-2">
            {data.timeline.map((day) => (
              <div key={day.date} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-24 shrink-0 text-xs">{day.date.slice(5)}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className="bg-violet-500 h-5 rounded-r-md transition-all"
                    style={{ width: `${(day.reviews / maxTimelineReviews) * 50}%`, minWidth: "4px" }}
                  />
                  <span className="text-xs text-foreground font-medium">{day.reviews} reviews</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className="bg-orange-500 h-5 rounded-r-md transition-all"
                    style={{ width: `${(day.findings / maxTimelineFindings) * 50}%`, minWidth: "4px" }}
                  />
                  <span className="text-xs text-muted-foreground">{day.findings} findings</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Severity Distribution</h2>
          <div className="space-y-3">
            {Object.entries(data.severityDist)
              .filter(([, count]) => count > 0)
              .sort((a, b) => {
                const order = ["critical", "high", "medium", "low", "info"];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
              })
              .map(([severity, count]) => (
                <div key={severity} className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase w-16 text-muted-foreground">{severity}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className={`${severityColors[severity]} h-full rounded-full transition-all`}
                      style={{ width: `${(count / data.totalFindings) * 100}%`, minWidth: "8px" }}
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Agent Distribution */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Findings by Agent</h2>
          <div className="space-y-3">
            {Object.entries(data.agentDist)
              .sort((a, b) => b[1] - a[1])
              .map(([agent, count]) => {
                const cfg = agentConfig[agent] || { icon: null, color: "text-zinc-400" };
                return (
                  <div key={agent} className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 w-28 ${cfg.color}`}>
                      {cfg.icon}
                      <span className="text-xs font-bold capitalize">{agent}</span>
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-violet-500 h-full rounded-full transition-all"
                        style={{ width: `${(count / totalAgentFindings) * 100}%`, minWidth: "8px" }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Top Risky Files */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-orange-400" /> Top Risky Files
        </h2>
        {data.topFiles.length === 0 ? (
          <p className="text-muted-foreground text-sm">No findings yet.</p>
        ) : (
          <div className="space-y-2">
            {data.topFiles.map((file, i) => (
              <div key={file.file} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}.</span>
                <code className="text-xs text-foreground flex-1 truncate">{file.file}</code>
                <div className="w-32 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-orange-500 h-full rounded-full"
                    style={{ width: `${(file.count / maxFileCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-foreground w-12 text-right">{file.count} issues</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-Repo Stats */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FolderGit2 className="w-5 h-5 text-blue-400" /> Repository Breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.repos.map((repo) => (
            <div key={repo.name} className="bg-muted/50 border border-border rounded-lg p-4">
              <h3 className="text-sm font-bold text-foreground truncate">{repo.name}</h3>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{repo.reviews} reviews</span>
                <span>{repo.findings} findings</span>
                <span className="text-foreground font-medium">
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
