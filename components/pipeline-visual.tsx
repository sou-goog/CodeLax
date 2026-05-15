"use client";

import { useEffect, useRef, useState } from "react";
import {
  GitPullRequest, BrainCircuit, ShieldAlert, Zap,
  Paintbrush, CheckCircle2, MessageSquare, ArrowRight,
} from "lucide-react";

const steps = [
  {
    icon: <GitPullRequest className="w-5 h-5" />,
    label: "PR Opened",
    desc: "Webhook triggers review",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  {
    icon: <BrainCircuit className="w-5 h-5" />,
    label: "Planner",
    desc: "Analyzes diff & assigns agents",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    icon: <ShieldAlert className="w-5 h-5" />,
    label: "Specialists",
    desc: "Security · Performance · Logic · Style",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  {
    icon: <CheckCircle2 className="w-5 h-5" />,
    label: "Critic",
    desc: "Validates & filters false positives",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  {
    icon: <Paintbrush className="w-5 h-5" />,
    label: "Synthesizer",
    desc: "Generates review summary",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    label: "Review Posted",
    desc: "Inline comments + check run",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
];

export function PipelineVisual() {
  const [activeStep, setActiveStep] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let step = 0;
    const interval = setInterval(() => {
      setActiveStep(step);
      step++;
      if (step >= steps.length) {
        clearInterval(interval);
        // Loop after a pause
        setTimeout(() => {
          setActiveStep(-1);
          setHasStarted(false);
          setTimeout(() => setHasStarted(true), 500);
        }, 3000);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [hasStarted]);

  return (
    <div ref={ref} className="max-w-6xl mx-auto px-6">
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-start justify-between gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex flex-col items-center text-center transition-all duration-500 flex-1 ${
                i <= activeStep ? "opacity-100 translate-y-0" : "opacity-30 translate-y-2"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl ${s.bg} border ${
                  i <= activeStep ? s.border : "border-border"
                } flex items-center justify-center ${s.color} mb-3 transition-all duration-500 ${
                  i === activeStep ? "scale-110 shadow-lg" : ""
                }`}
              >
                {s.icon}
              </div>
              <p className="text-xs font-bold text-foreground mb-0.5">{s.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight max-w-[120px]">{s.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="pt-5">
                <ArrowRight
                  className={`w-4 h-4 transition-all duration-500 ${
                    i < activeStep ? "text-violet-400" : "text-border"
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden space-y-4">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-center gap-4 transition-all duration-500 ${
              i <= activeStep ? "opacity-100" : "opacity-30"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl ${s.bg} border ${
                i <= activeStep ? s.border : "border-border"
              } flex items-center justify-center ${s.color} shrink-0 transition-all duration-500 ${
                i === activeStep ? "scale-110" : ""
              }`}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
