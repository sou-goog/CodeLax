"use client";

import React from "react";
import {
  Download, Search, ShieldAlert, Zap, BrainCircuit,
  Paintbrush, Scale, FileOutput, Send, CheckCircle2,
} from "lucide-react";

const STEPS = [
  { key: "fetching", label: "Fetching PR data", icon: <Download className="w-4 h-4" /> },
  { key: "planning", label: "Planning review", icon: <Search className="w-4 h-4" /> },
  { key: "agents", label: "Running agents", icon: <ShieldAlert className="w-4 h-4" /> },
  { key: "critic", label: "Critic review", icon: <Scale className="w-4 h-4" /> },
  { key: "synthesizer", label: "Writing report", icon: <FileOutput className="w-4 h-4" /> },
  { key: "posting", label: "Posting to GitHub", icon: <Send className="w-4 h-4" /> },
];

const agentIcons: Record<string, React.ReactNode> = {
  security: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />,
  performance: <Zap className="w-3.5 h-3.5 text-yellow-400" />,
  logic: <BrainCircuit className="w-3.5 h-3.5 text-blue-400" />,
  style: <Paintbrush className="w-3.5 h-3.5 text-purple-400" />,
};

interface ReviewProgressProps {
  currentStep: string | null | undefined;
  compact?: boolean;
}

export function ReviewProgress({ currentStep, compact = false }: ReviewProgressProps) {
  if (!currentStep) return null;

  // Parse agent step: "agents:security,performance,logic"
  const isAgentStep = currentStep.startsWith("agents:");
  const activeAgents = isAgentStep ? currentStep.slice(7).split(",") : [];
  const normalizedStep = isAgentStep ? "agents" : currentStep;

  const currentIdx = STEPS.findIndex((s) => s.key === normalizedStep);

  if (compact) {
    const step = STEPS[currentIdx] || STEPS[0];
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="w-4 h-4 text-violet-400 animate-pulse">{step.icon}</div>
        <span className="text-muted-foreground">{step.label}</span>
        {isAgentStep && (
          <div className="flex items-center gap-1 ml-1">
            {activeAgents.map((a) => (
              <span key={a} title={a}>{agentIcons[a]}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-bold text-foreground mb-4">Review Progress</h3>
      <div className="space-y-0">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentIdx;
          const isDone = idx < currentIdx;
          const isPending = idx > currentIdx;

          return (
            <div key={step.key} className="flex items-start gap-3 relative">
              {/* Vertical line */}
              {idx < STEPS.length - 1 && (
                <div className={`absolute left-[15px] top-8 w-0.5 h-6 ${isDone ? "bg-emerald-500/40" : "bg-border"}`} />
              )}
              {/* Icon */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isDone
                    ? "bg-emerald-500/10 text-emerald-400"
                    : isActive
                    ? "bg-violet-500/10 text-violet-400 animate-pulse"
                    : "bg-muted/50 text-muted-foreground/50"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
              </div>
              {/* Label */}
              <div className="pt-1.5 pb-4">
                <p
                  className={`text-sm font-medium ${
                    isDone ? "text-emerald-400" : isActive ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  {step.label}
                  {isActive && step.key === "agents" && activeAgents.length > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({activeAgents.join(", ")})
                    </span>
                  )}
                </p>
                {isActive && step.key === "agents" && activeAgents.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    {activeAgents.map((a) => (
                      <div
                        key={a}
                        className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-md px-2 py-1"
                      >
                        {agentIcons[a]}
                        <span className="text-[10px] text-muted-foreground capitalize">{a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
