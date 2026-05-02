"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { getReviews } from "@/module/review/action";
import { GitPullRequest, ExternalLink, ShieldAlert, Zap, BrainCircuit, Paintbrush, Calendar } from "lucide-react";
import { Button } from '@/components/ui/button';
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

const agentIcons: Record<string, React.ReactNode> = {
  security: <ShieldAlert className="w-4 h-4 mr-1 text-red-500" />,
  performance: <Zap className="w-4 h-4 mr-1 text-yellow-500" />,
  logic: <BrainCircuit className="w-4 h-4 mr-1 text-blue-500" />,
  style: <Paintbrush className="w-4 h-4 mr-1 text-purple-500" />
};

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  info: "bg-slate-500/10 text-slate-500 border-slate-500/20",
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
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Code Reviews</h1>
        <p className="text-muted-foreground">Detailed findings from your multi-agent review pipeline.</p>
      </div>

      {reviews.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitPullRequest className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No reviews yet</h3>
            <p className="text-muted-foreground mb-4">Trigger an AI review on one of your repositories.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {reviews.map((review) => {
            const findings = review.findings || [];
            
            // Count findings by severity
            const criticalCount = findings.filter((f: ReviewFinding) => f.severity === 'critical').length;
            const highCount = findings.filter((f: ReviewFinding) => f.severity === 'high').length;
            const mediumCount = findings.filter((f: ReviewFinding) => f.severity === 'medium').length;
            
            // Determine overall risk visually
            let overallRiskBadge = null;
            if (criticalCount > 0) overallRiskBadge = <Badge variant="destructive" className="ml-2">Critical Risk</Badge>;
            else if (highCount > 0) overallRiskBadge = <Badge className="bg-orange-500 hover:bg-orange-600 ml-2">High Risk</Badge>;
            else if (mediumCount > 0) overallRiskBadge = <Badge variant="secondary" className="ml-2 text-yellow-600">Medium Risk</Badge>;
            else overallRiskBadge = <Badge variant="outline" className="ml-2 text-green-500 border-green-500/30 bg-green-500/10">Low Risk</Badge>;

            return (
              <Card key={review.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50 pb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <span className="font-medium text-foreground mr-2">{review.repository.fullName}</span>
                        <span>•</span>
                        <Calendar className="w-3 h-3 mx-1" />
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </div>
                      <CardTitle className="text-xl flex items-center">
                        <GitPullRequest className="w-5 h-5 mr-2" />
                        {review.prTitle}
                        {overallRiskBadge}
                      </CardTitle>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={review.prUrl} target="_blank" rel="noreferrer">
                        View PR on GitHub <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0">
                  {findings.length > 0 ? (
                    <div className="divide-y">
                      {findings.map((finding: ReviewFinding) => (
                        <div key={finding.id} className="p-4 sm:p-6 hover:bg-muted/30 transition-colors">
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="sm:w-1/4">
                              <Badge variant="outline" className={severityColors[finding.severity] || severityColors.info}>
                                {finding.severity.toUpperCase()}
                              </Badge>
                              <div className="flex items-center mt-3 text-sm font-medium">
                                {agentIcons[finding.agentName]}
                                <span className="capitalize">{finding.agentName} Agent</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {(finding.confidence * 100).toFixed(0)}% Confidence
                              </div>
                            </div>
                            <div className="sm:w-3/4 space-y-2">
                              <h4 className="text-base font-semibold">{finding.title}</h4>
                              <p className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
                                {finding.file}
                              </p>
                              <p className="text-sm text-muted-foreground mt-2">
                                {finding.description}
                              </p>
                              <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mt-3">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  <strong>Suggestion:</strong> {finding.suggestion}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-4">
                        <ShieldAlert className="w-6 h-6 text-green-500" />
                      </div>
                      <h4 className="text-lg font-medium">No issues found</h4>
                      <p className="text-muted-foreground">The AI review completed successfully but did not find any critical issues to report.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
