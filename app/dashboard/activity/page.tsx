"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActivityFeed } from "@/module/activity/actions";
import { formatDistanceToNow } from "date-fns";
import {
  Activity, BrainCircuit, GitPullRequest, Shield, Settings2,
  Webhook, Users, FolderOpen, Filter, Loader2, AlertTriangle,
  CheckCircle2, XCircle, Zap, Clock,
} from "lucide-react";

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  review: { icon: <BrainCircuit className="w-4 h-4" />, color: "text-violet-400", bg: "bg-violet-500/10" },
  finding: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-amber-400", bg: "bg-amber-500/10" },
  webhook: { icon: <Webhook className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/10" },
  repository: { icon: <FolderOpen className="w-4 h-4" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  config: { icon: <Settings2 className="w-4 h-4" />, color: "text-orange-400", bg: "bg-orange-500/10" },
  team: { icon: <Users className="w-4 h-4" />, color: "text-pink-400", bg: "bg-pink-500/10" },
  rule: { icon: <Shield className="w-4 h-4" />, color: "text-cyan-400", bg: "bg-cyan-500/10" },
};

const filterOptions = [
  { value: "", label: "All Events" },
  { value: "review", label: "Reviews" },
  { value: "finding", label: "Findings" },
  { value: "webhook", label: "Webhooks" },
  { value: "repository", label: "Repositories" },
  { value: "team", label: "Teams" },
  { value: "rule", label: "Rules" },
];

export default function ActivityPage() {
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["activity", filter, cursor],
    queryFn: () => getActivityFeed({ type: filter || undefined, limit: 30, cursor: cursor || undefined }),
  });

  const events = data?.events ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-violet-400" />
            Activity Feed
          </h1>
          <p className="text-muted-foreground">All events across your repositories and reviews.</p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setCursor(null); }}
            className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            {filterOptions.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
          <Activity className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No activity yet</h3>
          <p className="text-muted-foreground text-sm mt-1">Events will appear here as you use CodeLax.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border/60 hidden sm:block" />

          <div className="space-y-1">
            {events.map((event: any) => {
              const tc = typeConfig[event.type] || typeConfig.review;
              return (
                <div key={event.id} className="flex gap-4 group">
                  {/* Timeline dot */}
                  <div className={`w-10 h-10 rounded-xl ${tc.bg} flex items-center justify-center shrink-0 ${tc.color} ring-4 ring-background z-10 hidden sm:flex`}>
                    {tc.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-card border border-border rounded-xl px-4 py-3 hover:bg-muted/20 transition-colors mb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`sm:hidden ${tc.color}`}>{tc.icon}</span>
                        <p className="text-xs font-medium text-foreground truncate">
                          <span className="font-bold">{event.action}</span>
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {event.targetType && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        <span className="capitalize">{event.targetType}</span>
                        {event.metadata?.name && <span className="font-mono"> {event.metadata.name}</span>}
                      </p>
                    )}

                    {event.metadata?.description && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">{event.metadata.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {data?.hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => setCursor(data.nextCursor)}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
