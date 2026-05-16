"use client";

import React, { useState, useEffect } from "react";
import { Key, Copy, RefreshCw, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export function ExtensionSettings() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchKey();
  }, []);

  const fetchKey = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/extension/key");
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.key);
      }
    } catch (err) {
      console.error("Failed to fetch API key", err);
    } finally {
      setLoading(false);
    }
  };

  const regenerateKey = async () => {
    try {
      setGenerating(true);
      const res = await fetch("/api/extension/key", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.key);
        toast.success("API key regenerated");
      } else {
        toast.error("Failed to regenerate API key");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden mt-8">
      <div className="px-6 py-5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-foreground">VS Code Extension</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your CodeLax editor extension to get AI review feedback right in your IDE.
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Extension API Key
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={loading ? "Loading..." : apiKey || "No API key found"}
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none"
              />
              <button
                onClick={copyToClipboard}
                disabled={!apiKey || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={regenerateKey}
              disabled={loading || generating}
              className="px-4 py-2 bg-card border border-border text-foreground hover:bg-muted text-sm font-medium rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={\`w-4 h-4 \${generating ? "animate-spin" : ""}\`} />
              Regenerate
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <ShieldAlert className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500/90 leading-relaxed">
              Keep this key secret. Anyone with this key can access your CodeLax reviews and repositories.
              If it gets compromised, regenerate it immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
