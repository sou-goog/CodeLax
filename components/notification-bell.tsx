"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAsRead, markAllAsRead } from "@/module/notification/actions";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, BrainCircuit, AlertTriangle, CheckCircle2, XCircle,
  Webhook, X, Check, ExternalLink,
} from "lucide-react";
import Link from "next/link";

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  review_completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  review_failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-400", bg: "bg-red-500/10" },
  critical_finding: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-red-400", bg: "bg-red-500/10" },
  high_finding: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-orange-400", bg: "bg-orange-500/10" },
  webhook_failed: { icon: <Webhook className="w-3.5 h-3.5" />, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  team_invite: { icon: <Bell className="w-3.5 h-3.5" />, color: "text-pink-400", bg: "bg-pink-500/10" },
  new_review: { icon: <BrainCircuit className="w-3.5 h-3.5" />, color: "text-violet-400", bg: "bg-violet-500/10" },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(20),
    refetchInterval: 30000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm shadow-red-500/50 animate-in zoom-in duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors font-medium"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">You'll see alerts for reviews, findings, and webhook issues here.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const tc = typeConfig[n.type] || typeConfig.new_review;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors ${
                      !n.read ? "bg-violet-500/[0.03]" : ""
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${tc.bg} flex items-center justify-center shrink-0 mt-0.5 ${tc.color}`}>
                      {tc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium truncate ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                            className="shrink-0 text-muted-foreground/50 hover:text-violet-400 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => { setOpen(false); if (!n.read) handleMarkRead(n.id); }}
                            className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                          >
                            View <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
