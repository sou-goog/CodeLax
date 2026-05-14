"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  if (compact) {
    return (
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    );
  }

  const options = [
    { value: "light", label: "Light", icon: <Sun className="w-3.5 h-3.5" /> },
    { value: "dark", label: "Dark", icon: <Moon className="w-3.5 h-3.5" /> },
    { value: "system", label: "System", icon: <Monitor className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Theme"
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : theme === "light" ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg p-1 z-50 min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-150">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setTheme(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors ${
                theme === opt.value
                  ? "bg-violet-500/10 text-violet-400 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
