"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWebhookHealth, pingWebhook, type WebhookInfo } from "@/module/webhook/actions";
import {
  Webhook, CheckCircle2, XCircle, Clock, Activity,
  Loader2, RefreshCw, Zap, AlertTriangle, Radio,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusDot = (active: boolean) =>
  active ? "bg-emerald-500 shadow-emerald-500/50 shadow-sm" : "bg-red-500 shadow-red-500/50 shadow-sm";

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [pinging, setPinging] = React.useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery<WebhookInfo[]>({
    queryKey: ["webhook-health"],
    queryFn: () => getWebhookHealth(),
    refetchOnWindowFocus: false,
  });

  const handlePing = async (repoFullName: string, webhookId: number) => {
    setPinging(repoFullName);
    try {
      await pingWebhook(repoFullName, webhookId);
      await queryClient.invalidateQueries({ queryKey: ["webhook-health"] });
    } catch (e) {
      console.error("Ping failed:", e);
    } finally {
      setPinging(null);
    }
  };

  const totalActive = webhooks.filter((w) => w.active).length;
  const avgSuccessRate = webhooks.length > 0
    ? Math.round(webhooks.reduce((s, w) => s + w.successRate, 0) / webhooks.length)
    : 0;
  const totalDeliveries = webhooks.reduce((s, w) => s + w.recentDeliveries.length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Checking webhook status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Webhook Health</h1>
        <p className="text-muted-foreground">Monitor webhook delivery status across your connected repositories.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Repos", value: webhooks.length, icon: <Webhook className="w-4 h-4" />, color: "text-violet-400" },
          { label: "Active Hooks", value: totalActive, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-emerald-400" },
          { label: "Success Rate", value: `${avgSuccessRate}%`, icon: <Activity className="w-4 h-4" />, color: avgSuccessRate >= 90 ? "text-emerald-400" : avgSuccessRate >= 70 ? "text-yellow-400" : "text-red-400" },
          { label: "Recent Deliveries", value: totalDeliveries, icon: <Zap className="w-4 h-4" />, color: "text-blue-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Webhook list */}
      {webhooks.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
          <Webhook className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No repositories connected</h3>
          <p className="text-muted-foreground text-sm">Connect a repository to monitor webhook health.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div key={webhook.repoFullName} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Repo header */}
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(webhook.active)}`} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{webhook.repoFullName}</h3>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span className={webhook.active ? "text-emerald-400" : "text-red-400"}>
                        {webhook.active ? "Active" : webhook.webhookId ? "Inactive" : "No webhook"}
                      </span>
                      {webhook.events.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{webhook.events.join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Success rate badge */}
                  <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    webhook.successRate >= 90
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : webhook.successRate >= 70
                      ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                      : "text-red-400 bg-red-500/10 border-red-500/20"
                  }`}>
                    {webhook.successRate}% success
                  </div>

                  {/* Ping button */}
                  {webhook.webhookId && (
                    <button
                      onClick={() => handlePing(webhook.repoFullName, webhook.webhookId!)}
                      disabled={pinging === webhook.repoFullName}
                      className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-violet-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {pinging === webhook.repoFullName ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Radio className="w-3 h-3" />
                      )}
                      Ping
                    </button>
                  )}
                </div>
              </div>

              {/* Recent deliveries */}
              {webhook.recentDeliveries.length > 0 && (
                <div className="border-t border-border">
                  <div className="px-5 py-2 bg-muted/30">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Recent Deliveries</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {webhook.recentDeliveries.slice(0, 5).map((delivery) => (
                      <div key={delivery.id} className="px-5 py-2.5 flex items-center gap-3 text-xs hover:bg-muted/20 transition-colors">
                        {delivery.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="font-mono text-foreground font-medium">{delivery.event}</span>
                        {delivery.action && <span className="text-muted-foreground">({delivery.action})</span>}
                        <span className={`ml-auto shrink-0 font-mono ${
                          delivery.statusCode >= 200 && delivery.statusCode < 300
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}>
                          {delivery.statusCode}
                        </span>
                        <span className="text-muted-foreground/60 shrink-0">{delivery.duration}ms</span>
                        <span className="text-muted-foreground/60 shrink-0">
                          {formatDistanceToNow(new Date(delivery.deliveredAt), { addSuffix: true })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {webhook.recentDeliveries.length === 0 && webhook.webhookId && (
                <div className="border-t border-border px-5 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No recent deliveries</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
