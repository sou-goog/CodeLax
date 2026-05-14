"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchRepositories, connectRepository } from "@/module/repository/actions";
import {
  Github, FolderGit2, CheckCircle2, ArrowRight,
  Loader2, GitPullRequest, Terminal, Sparkles,
} from "lucide-react";

type Step = "welcome" | "connect" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("welcome");
  const [connecting, setConnecting] = React.useState<number | null>(null);
  const [connected, setConnected] = React.useState<Set<number>>(new Set());

  const { data: repos = [], isLoading } = useQuery({
    queryKey: ["github-repos-onboarding"],
    queryFn: () => fetchRepositories(1, 20),
    enabled: step === "connect",
  });

  const handleConnect = async (owner: string, name: string, githubId: number) => {
    try {
      setConnecting(githubId);
      await connectRepository(owner, name, githubId);
      setConnected((prev) => new Set([...prev, githubId]));
    } catch (e) {
      console.error("Failed to connect:", e);
    } finally {
      setConnecting(null);
    }
  };

  const connectedCount = repos.filter((r: any) => r.isConnected || connected.has(r.id)).length;

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-2xl mx-auto px-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {(["welcome", "connect", "done"] as Step[]).map((s, i) => {
            const stepNames = ["Welcome", "Connect Repos", "Ready"];
            const isActive = s === step;
            const isDone = (["welcome", "connect", "done"].indexOf(step) > i);
            return (
              <React.Fragment key={s}>
                {i > 0 && <div className={`w-8 h-px ${isDone ? "bg-violet-500" : "bg-border"}`} />}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone ? "bg-violet-500 text-white" : isActive ? "bg-violet-500/10 text-violet-400 ring-2 ring-violet-500/30" : "bg-muted text-muted-foreground"
                  }`}>
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {stepNames[i]}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Step: Welcome */}
        {step === "welcome" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto">
              <Terminal className="w-10 h-10 text-violet-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome to CodeLax</h1>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                Let&apos;s get your AI-powered code reviews set up. It only takes a minute.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {[
                { icon: <Github className="w-5 h-5" />, label: "Connect repos" },
                { icon: <GitPullRequest className="w-5 h-5" />, label: "Open a PR" },
                { icon: <Sparkles className="w-5 h-5" />, label: "Get AI reviews" },
              ].map((item, i) => (
                <div key={i} className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col items-center gap-2">
                  <div className="text-violet-400">{item.icon}</div>
                  <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("connect")}
              className="mt-6 px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/20 flex items-center gap-2 mx-auto text-sm"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Connect repos */}
        {step === "connect" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Connect your repositories</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Select at least one repo to enable AI reviews.
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {repos.map((repo: any) => {
                  const isConnected = repo.isConnected || connected.has(repo.id);
                  const isConnecting = connecting === repo.id;
                  return (
                    <div
                      key={repo.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        isConnected
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border bg-card hover:border-violet-500/30"
                      }`}
                    >
                      <FolderGit2 className={`w-5 h-5 shrink-0 ${isConnected ? "text-emerald-400" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{repo.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{repo.private ? "Private" : "Public"} · {repo.language || "—"}</p>
                      </div>
                      {isConnected ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(repo.owner.login, repo.name, repo.id)}
                          disabled={isConnecting}
                          className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {isConnecting ? "Connecting..." : "Connect"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                {connectedCount} repo{connectedCount !== 1 ? "s" : ""} connected
              </p>
              <button
                onClick={() => setStep("done")}
                disabled={connectedCount === 0}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">You&apos;re all set!</h1>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                CodeLax will automatically review every pull request on your connected repos. Open a PR to see it in action.
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-5 max-w-sm mx-auto text-left space-y-3">
              <p className="text-xs font-medium text-foreground">What happens next:</p>
              {[
                "Open or push to a PR on a connected repo",
                "CodeLax analyzes changes with 4 AI agents",
                "Get findings posted as inline PR comments",
                "View detailed reports in your dashboard",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-violet-400">{i + 1}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/20 flex items-center gap-2 mx-auto text-sm"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
