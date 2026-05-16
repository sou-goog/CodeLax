import * as vscode from "vscode";

export interface ReviewFinding {
  id: string;
  agentName: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  file: string;
  startLine: number | null;
  endLine: number | null;
  title: string;
  description: string;
  suggestion: string;
}

export interface Review {
  id: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  currentStep: string | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  findings: ReviewFinding[];
}

export interface Repo {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  url: string;
  language: string | null;
  stars: number;
}

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("codelax");
  return {
    serverUrl: (cfg.get<string>("serverUrl") ?? "https://code-lax.vercel.app").replace(/\/$/, ""),
    apiKey: cfg.get<string>("apiKey") ?? "",
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const { serverUrl, apiKey } = getConfig();
  if (!apiKey) throw new Error("No API key configured. Run 'CodeLax: Configure API Key'.");

  const url = `${serverUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CodeLax API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchReviews(owner: string, repo: string, limit = 20): Promise<Review[]> {
  const data = await apiFetch<{ reviews: Review[] }>(
    `/api/extension/reviews?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&limit=${limit}`
  );
  return data.reviews ?? [];
}

export async function fetchRepos(): Promise<Repo[]> {
  const data = await apiFetch<{ repos: Repo[] }>("/api/extension/repos");
  return data.repos ?? [];
}

export function isConfigured(): boolean {
  const { apiKey } = getConfig();
  return apiKey.length > 0;
}

export function getServerUrl(): string {
  return getConfig().serverUrl;
}
