"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search, LayoutDashboard, FolderOpen, BrainCircuit, BarChart3,
  Settings, Settings2, Sun, Moon, Monitor, Keyboard, ArrowRight,
  X, Command,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const commands: CommandItem[] = [
    { id: "nav-dashboard", label: "Dashboard", description: "Go to main dashboard", icon: <LayoutDashboard className="w-4 h-4" />, action: () => router.push("/dashboard"), keywords: ["home", "main", "overview"], group: "Navigation" },
    { id: "nav-repos", label: "Repositories", description: "Manage connected repos", icon: <FolderOpen className="w-4 h-4" />, action: () => router.push("/dashboard/repository"), keywords: ["repos", "github", "connect"], group: "Navigation" },
    { id: "nav-reviews", label: "AI Reviews", description: "View all code reviews", icon: <BrainCircuit className="w-4 h-4" />, action: () => router.push("/dashboard/reviews"), keywords: ["reviews", "findings", "pr"], group: "Navigation" },
    { id: "nav-analytics", label: "Analytics", description: "Review trends & metrics", icon: <BarChart3 className="w-4 h-4" />, action: () => router.push("/dashboard/analytics"), keywords: ["stats", "charts", "trends"], group: "Navigation" },
    { id: "nav-config", label: "Config Editor", description: "Edit .codelax.yaml", icon: <Settings2 className="w-4 h-4" />, action: () => router.push("/dashboard/config"), keywords: ["config", "yaml", "settings", "agents"], group: "Navigation" },
    { id: "nav-rules", label: "Review Rules", description: "Custom pattern rules per repo", icon: <Search className="w-4 h-4" />, action: () => router.push("/dashboard/rules"), keywords: ["rules", "patterns", "regex", "custom"], group: "Navigation" },
    { id: "nav-teams", label: "Teams", description: "Manage workspaces & members", icon: <Search className="w-4 h-4" />, action: () => router.push("/dashboard/teams"), keywords: ["team", "org", "members", "invite"], group: "Navigation" },
    { id: "nav-webhooks", label: "Webhooks", description: "Webhook health & deliveries", icon: <Search className="w-4 h-4" />, action: () => router.push("/dashboard/webhooks"), keywords: ["webhook", "health", "delivery", "ping"], group: "Navigation" },
    { id: "nav-activity", label: "Activity Feed", description: "All events & timeline", icon: <Search className="w-4 h-4" />, action: () => router.push("/dashboard/activity"), keywords: ["activity", "events", "timeline", "feed"], group: "Navigation" },
    { id: "nav-settings", label: "Settings", description: "Account & preferences", icon: <Settings className="w-4 h-4" />, action: () => router.push("/dashboard/settings"), keywords: ["account", "profile", "preferences"], group: "Navigation" },
    { id: "theme-light", label: "Light Mode", description: "Switch to light theme", icon: <Sun className="w-4 h-4" />, action: () => setTheme("light"), keywords: ["theme", "light", "bright"], group: "Theme" },
    { id: "theme-dark", label: "Dark Mode", description: "Switch to dark theme", icon: <Moon className="w-4 h-4" />, action: () => setTheme("dark"), keywords: ["theme", "dark", "night"], group: "Theme" },
    { id: "theme-system", label: "System Theme", description: "Follow system preference", icon: <Monitor className="w-4 h-4" />, action: () => setTheme("system"), keywords: ["theme", "system", "auto"], group: "Theme" },
    { id: "shortcuts", label: "Keyboard Shortcuts", description: "View all shortcuts", icon: <Keyboard className="w-4 h-4" />, action: () => { setOpen(false); setShowShortcuts(true); }, keywords: ["hotkeys", "keys", "help"], group: "Help" },
  ];

  const filtered = query.trim()
    ? commands.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

  const groups = [...new Set(filtered.map((c) => c.group))];

  const handleSelect = useCallback((item: CommandItem) => {
    item.action();
    setOpen(false);
    setQuery("");
  }, []);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K — open palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }

      // ? — show shortcuts (only if not typing in an input)
      if (e.key === "?" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // Escape
      if (e.key === "Escape") {
        if (open) { setOpen(false); setQuery(""); }
        if (showShortcuts) setShowShortcuts(false);
      }

      // Navigation shortcuts (only when palette is closed and not in input)
      if (!open && !showShortcuts && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        if (e.key === "g") {
          const waitForNext = (ev: KeyboardEvent) => {
            const map: Record<string, string> = {
              d: "/dashboard",
              r: "/dashboard/reviews",
              a: "/dashboard/analytics",
              p: "/dashboard/repository",
              c: "/dashboard/config",
              u: "/dashboard/rules",
              t: "/dashboard/teams",
              w: "/dashboard/webhooks",
              f: "/dashboard/activity",
              s: "/dashboard/settings",
            };
            if (map[ev.key]) {
              ev.preventDefault();
              router.push(map[ev.key]);
            }
            window.removeEventListener("keydown", waitForNext);
          };
          window.addEventListener("keydown", waitForNext, { once: true });
          setTimeout(() => window.removeEventListener("keydown", waitForNext), 1000);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, showShortcuts, router]);

  // Arrow key navigation within palette
  useEffect(() => {
    if (!open) return;
    const handleNav = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      }
    };
    window.addEventListener("keydown", handleNav);
    return () => window.removeEventListener("keydown", handleNav);
  }, [open, filtered, selectedIndex, handleSelect]);

  // Reset index on query change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Auto-focus input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, open]);

  const shortcutGroups = [
    {
      title: "General",
      shortcuts: [
        { keys: ["Ctrl", "K"], desc: "Open command palette" },
        { keys: ["?"], desc: "Toggle shortcuts help" },
        { keys: ["Esc"], desc: "Close modal / palette" },
      ],
    },
    {
      title: "Navigation (press g then ...)",
      shortcuts: [
        { keys: ["g", "d"], desc: "Go to Dashboard" },
        { keys: ["g", "r"], desc: "Go to Reviews" },
        { keys: ["g", "a"], desc: "Go to Analytics" },
        { keys: ["g", "p"], desc: "Go to Repositories" },
        { keys: ["g", "c"], desc: "Go to Config Editor" },
        { keys: ["g", "u"], desc: "Go to Rules" },
        { keys: ["g", "t"], desc: "Go to Teams" },
        { keys: ["g", "w"], desc: "Go to Webhooks" },
        { keys: ["g", "f"], desc: "Go to Activity Feed" },
        { keys: ["g", "s"], desc: "Go to Settings" },
      ],
    },
  ];

  let flatIndex = -1;

  return (
    <>
      {/* Command Palette Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => { setOpen(false); setQuery(""); }}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 py-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">Esc</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No results found.</div>
              ) : (
                groups.map((group) => {
                  const items = filtered.filter((c) => c.group === group);
                  return (
                    <div key={group}>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-3 pt-3 pb-1">{group}</p>
                      {items.map((item) => {
                        flatIndex++;
                        const idx = flatIndex;
                        return (
                          <button
                            key={item.id}
                            data-index={idx}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedIndex === idx
                                ? "bg-violet-500/10 text-violet-400"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <div className={`shrink-0 ${selectedIndex === idx ? "text-violet-400" : "text-muted-foreground"}`}>
                              {item.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.label}</p>
                              {item.description && <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>}
                            </div>
                            <ArrowRight className={`w-3 h-3 shrink-0 ${selectedIndex === idx ? "text-violet-400 opacity-100" : "opacity-0"}`} />
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="bg-muted px-1 py-0.5 rounded font-mono">↑↓</kbd> Navigate</span>
                <span className="flex items-center gap-1"><kbd className="bg-muted px-1 py-0.5 rounded font-mono">↵</kbd> Select</span>
              </div>
              <span className="flex items-center gap-1"><kbd className="bg-muted px-1 py-0.5 rounded font-mono">?</kbd> Shortcuts</span>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Help Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-bold text-foreground">Keyboard Shortcuts</h2>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {shortcutGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{group.title}</p>
                  <div className="space-y-1.5">
                    {group.shortcuts.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-muted-foreground">{s.desc}</span>
                        <div className="flex items-center gap-1">
                          {s.keys.map((k, ki) => (
                            <React.Fragment key={ki}>
                              {ki > 0 && <span className="text-[10px] text-muted-foreground/50">then</span>}
                              <kbd className="min-w-[24px] text-center bg-muted border border-border text-foreground text-[11px] px-1.5 py-0.5 rounded font-mono font-medium">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
