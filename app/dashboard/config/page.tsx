"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getConnectedRepos, getRepoConfig, saveRepoConfig } from "@/module/review/action/config";
import {
  ShieldAlert, Zap, BrainCircuit, Paintbrush, Settings2,
  Save, Plus, X, Loader2, CheckCircle2, FileCode2, AlertCircle,
} from "lucide-react";

type AgentName = "security" | "performance" | "logic" | "style";

const agentInfo: Record<AgentName, { icon: React.ReactNode; label: string; description: string; color: string }> = {
  security: { icon: <ShieldAlert className="w-5 h-5" />, label: "Security", description: "Detects vulnerabilities, injection flaws, auth issues", color: "text-red-400" },
  performance: { icon: <Zap className="w-5 h-5" />, label: "Performance", description: "Finds N+1 queries, memory leaks, slow patterns", color: "text-yellow-400" },
  logic: { icon: <BrainCircuit className="w-5 h-5" />, label: "Logic", description: "Catches bugs, race conditions, edge cases", color: "text-blue-400" },
  style: { icon: <Paintbrush className="w-5 h-5" />, label: "Style", description: "Enforces code quality, naming, best practices", color: "text-purple-400" },
};

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const [selectedRepoId, setSelectedRepoId] = React.useState<string>("");
  const [agents, setAgents] = React.useState<AgentName[]>(["security", "performance", "logic", "style"]);
  const [ignorePatterns, setIgnorePatterns] = React.useState<string[]>([]);
  const [newIgnore, setNewIgnore] = React.useState("");
  const [instructions, setInstructions] = React.useState<string[]>([]);
  const [newInstruction, setNewInstruction] = React.useState("");
  const [minSeverity, setMinSeverity] = React.useState<string>("medium");
  const [maxInlineComments, setMaxInlineComments] = React.useState(5);
  const [autoDescription, setAutoDescription] = React.useState(true);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const { data: repos = [], isLoading: reposLoading } = useQuery({
    queryKey: ["connected-repos"],
    queryFn: () => getConnectedRepos(),
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["repo-config", selectedRepoId],
    queryFn: () => getRepoConfig(selectedRepoId),
    enabled: !!selectedRepoId,
  });

  // Sync form when config loads
  React.useEffect(() => {
    if (configData?.config) {
      const c = configData.config;
      setAgents(c.agents || ["security", "performance", "logic", "style"]);
      setIgnorePatterns(c.ignore || []);
      setInstructions(c.instructions || []);
      setMinSeverity(c.minSeverity || "medium");
      setMaxInlineComments(c.maxInlineComments ?? 5);
      setAutoDescription(c.autoDescription !== false);
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveRepoConfig(selectedRepoId, {
        agents,
        ignore: ignorePatterns,
        instructions,
        minSeverity: minSeverity as "critical" | "high" | "medium" | "low",
        maxInlineComments,
        autoDescription,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repo-config", selectedRepoId] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const toggleAgent = (name: AgentName) => {
    setAgents((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const addIgnore = () => {
    if (newIgnore.trim() && !ignorePatterns.includes(newIgnore.trim())) {
      setIgnorePatterns([...ignorePatterns, newIgnore.trim()]);
      setNewIgnore("");
    }
  };

  const addInstruction = () => {
    if (newInstruction.trim()) {
      setInstructions([...instructions, newInstruction.trim()]);
      setNewInstruction("");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Config Editor</h1>
        <p className="text-muted-foreground">
          Configure <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs">.codelax.yaml</code> for your repositories from the dashboard.
        </p>
      </div>

      {/* Repo selector */}
      <div className="bg-card border border-border rounded-xl p-5">
        <label className="text-sm font-medium text-foreground block mb-2">Select Repository</label>
        {reposLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading repositories...
          </div>
        ) : repos.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="w-4 h-4" /> No repositories connected. Add one from the Repositories page first.
          </div>
        ) : (
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full max-w-md focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="">Choose a repository...</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.fullName}</option>
            ))}
          </select>
        )}
      </div>

      {selectedRepoId && configLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      )}

      {selectedRepoId && configData && (
        <div className="space-y-6">
          {!configData.exists && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-400">No config file found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This repo doesn&apos;t have a <code>.codelax.yaml</code> yet. Configure below and save to create it.
                </p>
              </div>
            </div>
          )}

          {/* Agents */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-violet-400" />
              <h2 className="text-base font-bold text-foreground">Active Agents</h2>
            </div>
            <p className="text-xs text-muted-foreground">Select which AI agents analyze your pull requests.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(agentInfo) as AgentName[]).map((name) => {
                const info = agentInfo[name];
                const active = agents.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleAgent(name)}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-all text-left ${
                      active
                        ? "bg-violet-500/5 border-violet-500/30"
                        : "bg-muted/30 border-border opacity-50"
                    }`}
                  >
                    <div className={`${info.color} mt-0.5`}>{info.icon}</div>
                    <div>
                      <div className="text-sm font-bold text-foreground flex items-center gap-2">
                        {info.label}
                        {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ignore patterns */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-violet-400" />
              <h2 className="text-base font-bold text-foreground">Ignore Patterns</h2>
            </div>
            <p className="text-xs text-muted-foreground">Files matching these glob patterns will be skipped during review.</p>
            <div className="flex flex-wrap gap-2">
              {ignorePatterns.map((p, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground">
                  {p}
                  <button onClick={() => setIgnorePatterns(ignorePatterns.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newIgnore}
                onChange={(e) => setNewIgnore(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addIgnore()}
                placeholder="e.g. **/*.test.ts, docs/*, *.md"
                className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground flex-1 max-w-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <button onClick={addIgnore} className="bg-violet-500/10 border border-violet-500/20 text-violet-400 px-3 py-2 rounded-lg text-sm hover:bg-violet-500/20 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Review settings */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-foreground">Review Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Min Severity for Inline Comments</label>
                <select
                  value={minSeverity}
                  onChange={(e) => setMinSeverity(e.target.value)}
                  className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                >
                  <option value="critical">Critical only</option>
                  <option value="high">High+</option>
                  <option value="medium">Medium+</option>
                  <option value="low">All</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Max Inline Comments</label>
                <input
                  type="number"
                  value={maxInlineComments}
                  onChange={(e) => setMaxInlineComments(parseInt(e.target.value) || 1)}
                  min={1}
                  max={20}
                  className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Auto-generate PR Description</label>
                <button
                  onClick={() => setAutoDescription(!autoDescription)}
                  className={`w-14 h-7 rounded-full transition-colors relative ${autoDescription ? "bg-violet-500" : "bg-muted border border-border"}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${autoDescription ? "left-8" : "left-1"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Custom instructions */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-foreground">Custom Instructions</h2>
            <p className="text-xs text-muted-foreground">Natural language rules that all agents will follow during review.</p>
            <div className="space-y-2">
              {instructions.map((inst, i) => (
                <div key={i} className="flex items-start gap-2 bg-muted/50 border border-border rounded-lg p-3">
                  <span className="text-violet-400 text-sm font-bold shrink-0">{i + 1}.</span>
                  <p className="text-sm text-muted-foreground flex-1">{inst}</p>
                  <button onClick={() => setInstructions(instructions.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addInstruction()}
                placeholder='e.g. "Always flag console.log statements", "We use Zod for validation"'
                className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground flex-1 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <button onClick={addInstruction} className="bg-violet-500/10 border border-violet-500/20 text-violet-400 px-3 py-2 rounded-lg text-sm hover:bg-violet-500/20 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveMutation.isPending ? "Saving..." : "Save Config"}
            </button>
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Saved to repository
              </span>
            )}
            {saveMutation.isError && (
              <span className="text-red-400 text-sm">Failed to save. Check repo permissions.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
