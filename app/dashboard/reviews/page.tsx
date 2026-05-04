"use client";

import React from 'react';
import { getReviews } from "@/module/review/action";
import { GitPullRequest, ExternalLink, ShieldAlert, Zap, BrainCircuit, Paintbrush, Calendar } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from "@tanstack/react-query";

interface ReviewFinding {
  id: string;
  agentName: string;
  severity: string;
  confidence: number;
  file: string;
  title: string;
  description: string;
  suggestion: string;
}

interface Review {
  id: string;
  prTitle: string;
  prUrl: string;
  createdAt: string;
  repository: { fullName: string };
  findings: ReviewFinding[];
}

const agentConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  security: { icon: <ShieldAlert className="w-4 h-4" />, color: "text-red-400", bg: "bg-red-500/20" },
  performance: { icon: <Zap className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/20" },
  logic: { icon: <BrainCircuit className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/20" },
  style: { icon: <Paintbrush className="w-4 h-4" />, color: "text-purple-400", bg: "bg-purple-500/20" },
};

const severityConfig: Record<string, { color: string; dot: string; border: string }> = {
  critical: { color: "text-red-400", dot: "bg-red-500", border: "border-l-red-500" },
  high: { color: "text-orange-400", dot: "bg-orange-500", border: "border-l-orange-500" },
  medium: { color: "text-yellow-400", dot: "bg-yellow-500", border: "border-l-yellow-500" },
  low: { color: "text-blue-400", dot: "bg-blue-500", border: "border-l-blue-500" },
  info: { color: "text-zinc-400", dot: "bg-zinc-500", border: "border-l-zinc-500" },
};

export default function ReviewsPage() {
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["reviews"],
    queryFn: async () => await getReviews() as unknown as Review[],
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">AI Reviews</h1>
        <p className="text-muted-foreground">Detailed findings from your multi-agent review pipeline.</p>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-xl flex flex-col items-center justify-center py-16">
          <GitPullRequest className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No reviews yet</h3>
          <p className="text-muted-foreground mb-4">Connect a repository and open a PR to trigger an AI review.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {reviews.map((review) => {
            const findings = review.findings || [];
            const criticalCount = findings.filter((f) => f.severity === 'critical').length;
            const highCount = findings.filter((f) => f.severity === 'high').length;

            return (
              <div key={review.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Review Header */}
                <div className="px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center text-xs text-muted-foreground mb-2 gap-2">
                      <span className="font-medium text-foreground">{review.repository.fullName}</span>
                      <span>·</span>
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                    </div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <GitPullRequest className="w-5 h-5 text-violet-400" />
                      {review.prTitle}
                      {criticalCount > 0 && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-red-500/20">
                          {criticalCount} Critical
                        </span>
                      )}
                      {highCount > 0 && (
                        <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-orange-500/20">
                          {highCount} High
                        </span>
                      )}
                    </h3>
                  </div>
                  <a
                    href={review.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-muted border border-border text-foreground text-xs px-4 py-2 rounded-lg font-medium hover:border-violet-500/30 transition-colors flex items-center gap-2 w-fit"
                  >
                    View PR <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Findings */}
                {findings.length > 0 ? (
                  <div>
                    {findings.map((finding) => {
                      const sev = severityConfig[finding.severity] || severityConfig.info;
                      const agent = agentConfig[finding.agentName] || agentConfig.logic;
                      return (
                        <div key={finding.id} className={`border-b border-border/50 border-l-4 ${sev.border} p-5 hover:bg-muted/50 transition-colors`}>
                          <div className="flex flex-col sm:flex-row gap-4">
                            {/* Left: Agent + Severity */}
                            <div className="sm:w-56 shrink-0 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg ${agent.bg} flex items-center justify-center ${agent.color}`}>
                                  {agent.icon}
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-foreground capitalize">{finding.agentName} Agent</h5>
                                  <span className={`text-[10px] font-medium ${sev.color} flex items-center gap-1`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                                    {finding.severity.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground">Confidence: {(finding.confidence * 100).toFixed(0)}%</span>
                            </div>
                            {/* Right: Details */}
                            <div className="flex-1 space-y-2">
                              <h4 className="text-sm font-bold text-foreground">{finding.title}</h4>
                              <p className="text-xs font-mono bg-card px-2 py-1 rounded inline-block text-muted-foreground">{finding.file}</p>
                              <p className="text-[13px] text-muted-foreground leading-relaxed">{finding.description}</p>
                              {finding.suggestion && (
                                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 mt-2">
                                  <p className="text-[13px] text-violet-300">
                                    <strong>Suggestion:</strong> {finding.suggestion}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-4">
                      <ShieldAlert className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h4 className="text-lg font-medium text-foreground">All Clear</h4>
                    <p className="text-muted-foreground text-sm">No critical issues found in this review.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
