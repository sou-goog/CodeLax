"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRules, createRule, updateRule, deleteRule, getReposForRules,
} from "@/module/review/action/rules";
import {
  Shield, Plus, Trash2, Loader2, ToggleLeft, ToggleRight,
  AlertTriangle, FileCode2, Regex,
} from "lucide-react";

const sevOptions = ["critical", "high", "medium", "low", "info"];
const sevColor: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  info: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

export default function RulesPage() {
  const queryClient = useQueryClient();
  const [selectedRepo, setSelectedRepo] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", pattern: "", severity: "medium" });
  const [saving, setSaving] = useState(false);

  const { data: repos = [] } = useQuery({
    queryKey: ["repos-for-rules"],
    queryFn: () => getReposForRules(),
  });

  useEffect(() => {
    if (repos.length > 0 && !selectedRepo) setSelectedRepo(repos[0].id);
  }, [repos, selectedRepo]);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["rules", selectedRepo],
    queryFn: () => getRules(selectedRepo),
    enabled: !!selectedRepo,
  });

  const handleCreate = async () => {
    if (!form.name.trim() || !form.pattern.trim()) return;
    setSaving(true);
    try {
      await createRule({ ...form, repositoryId: selectedRepo });
      setForm({ name: "", description: "", pattern: "", severity: "medium" });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["rules", selectedRepo] });
    } catch (e: any) {
      alert(e.message || "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    await updateRule(ruleId, { enabled: !enabled });
    queryClient.invalidateQueries({ queryKey: ["rules", selectedRepo] });
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Delete this rule?")) return;
    await deleteRule(ruleId);
    queryClient.invalidateQueries({ queryKey: ["rules", selectedRepo] });
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Review Rules</h1>
          <p className="text-muted-foreground">Define custom patterns to auto-flag in every review.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          disabled={!selectedRepo}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Repo selector */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-2">Repository</label>
        <select
          value={selectedRepo}
          onChange={(e) => { setSelectedRepo(e.target.value); setShowAdd(false); }}
          className="w-full max-w-sm bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          {repos.map((r: any) => (
            <option key={r.id} value={r.id}>{r.fullName}</option>
          ))}
        </select>
      </div>

      {/* Add rule form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-bold text-foreground">New Rule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-1.5">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. No console.log"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-1.5">Pattern (regex)</label>
              <input
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                placeholder="e.g. console\\.log\\("
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Why this pattern should be flagged..."
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block mb-1.5">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {sevOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={handleCreate}
              disabled={!form.name.trim() || !form.pattern.trim() || saving}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40 mt-auto"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Rule
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl flex flex-col items-center justify-center py-16">
          <Shield className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No rules defined</h3>
          <p className="text-muted-foreground text-sm mt-1">Add custom rules to auto-flag patterns in code reviews.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => {
            const sc = sevColor[rule.severity] || sevColor.medium;
            return (
              <div
                key={rule.id}
                className={`bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 transition-opacity ${
                  !rule.enabled ? "opacity-50" : ""
                }`}
              >
                <div className="shrink-0">
                  <Regex className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-bold text-foreground">{rule.name}</h4>
                    <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${sc}`}>
                      {rule.severity}
                    </span>
                  </div>
                  {rule.description && <p className="text-[11px] text-muted-foreground">{rule.description}</p>}
                  <code className="text-[11px] font-mono text-violet-400/80 bg-violet-500/5 px-2 py-0.5 rounded mt-1 inline-block">
                    {rule.pattern}
                  </code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(rule.id, rule.enabled)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={rule.enabled ? "Disable" : "Enable"}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
