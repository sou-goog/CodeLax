import * as vscode from "vscode";
import * as path from "path";
import { Review, ReviewFinding, isConfigured, getServerUrl } from "./api";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6366f1",
  info: "#71717a",
};

const AGENT_COLOR: Record<string, string> = {
  security: "#ef4444",
  performance: "#eab308",
  logic: "#3b82f6",
  style: "#a855f7",
};

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _reviews: Review[] = [];
  private _loading = false;
  private _error = "";
  private _repoName = "";

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, "media")],
    };
    view.webview.onDidReceiveMessage(this.handleMessage.bind(this));
    this.render();
  }

  private handleMessage(msg: { command: string; payload?: unknown }) {
    switch (msg.command) {
      case "configure":
        vscode.commands.executeCommand("codelax.configure");
        break;
      case "refresh":
        vscode.commands.executeCommand("codelax.refresh");
        break;
      case "openBrowser":
        vscode.env.openExternal(vscode.Uri.parse(`${getServerUrl()}/dashboard/reviews`));
        break;
      case "jumpToFile": {
        const { file, line } = msg.payload as { file: string; line: number };
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        const absPath = path.isAbsolute(file) ? file : path.join(root, file);
        const uri = vscode.Uri.file(absPath);
        vscode.workspace.openTextDocument(uri).then(
          (doc) => {
            vscode.window.showTextDocument(doc, {
              selection: new vscode.Range(Math.max(0, line - 1), 0, Math.max(0, line - 1), 0),
              preserveFocus: false,
            });
          },
          () => {
            vscode.window.showWarningMessage(`CodeLax: Could not open file "${file}". Make sure the repo is open in this workspace.`);
          }
        );
        break;
      }
    }
  }

  setLoading(loading: boolean) { this._loading = loading; this.render(); }
  setError(error: string) { this._error = error; this._loading = false; this.render(); }
  setReviews(reviews: Review[], repoName: string) {
    this._reviews = reviews;
    this._repoName = repoName;
    this._loading = false;
    this._error = "";
    this.render();
  }

  private render() {
    if (!this._view) return;
    this._view.webview.html = this.buildHtml();
  }

  private buildHtml(): string {
    if (!isConfigured()) return this.buildConfigScreen();
    if (this._loading) return this.buildLoadingScreen();
    if (this._error) return this.buildErrorScreen(this._error);
    return this.buildReviewsScreen();
  }

  // ─── Screens ────────────────────────────────────────────────────────────────

  private buildConfigScreen(): string {
    return this.shell(`
      <div class="center-screen">
        <div class="logo-ring">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h2>CodeLax</h2>
        <p class="subtitle">Multi-Agent AI Code Review</p>
        <p class="body-text">Connect your CodeLax account to see findings directly in VS Code.</p>
        <button class="btn btn-primary" onclick="vscode.postMessage({command:'configure'})">
          Configure API Key
        </button>
        <p class="hint">Get your key from<br/>Dashboard → Settings → Extension</p>
      </div>
    `);
  }

  private buildLoadingScreen(): string {
    return this.shell(`
      <div class="center-screen">
        <div class="spinner"></div>
        <p class="body-text">Fetching reviews…</p>
      </div>
    `);
  }

  private buildErrorScreen(error: string): string {
    return this.shell(`
      <div class="center-screen">
        <div class="error-icon">⚠</div>
        <h3>Could not fetch reviews</h3>
        <p class="body-text error-text">${this.escape(error)}</p>
        <button class="btn btn-primary" onclick="vscode.postMessage({command:'refresh'})">Retry</button>
        <button class="btn btn-ghost" onclick="vscode.postMessage({command:'configure'})">Reconfigure</button>
      </div>
    `);
  }

  private buildReviewsScreen(): string {
    if (this._reviews.length === 0) {
      const repoInfo = this._repoName
        ? `<span class="repo-detected">Detected: <code>${this.escape(this._repoName)}</code></span>`
        : `<span class="repo-detected warn">⚠ Could not detect repo — open a connected repo folder</span>`;
      return this.shell(`
        <div class="center-screen">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
              <circle cx="18" cy="18" r="3"/><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5.7"/>
              <path d="M8 10h8M8 14h4"/>
            </svg>
          </div>
          <h3>No reviews yet</h3>
          ${repoInfo}
          <p class="body-text">Open a PR on a connected repo to trigger an AI review.</p>
          <button class="btn btn-ghost" onclick="vscode.postMessage({command:'openBrowser'})">Open Dashboard ↗</button>
          <button class="btn btn-ghost small" onclick="vscode.postMessage({command:'refresh'})">↻ Refresh</button>
        </div>
      `);
    }

    const repoLabel = this._repoName ? `<span class="repo-badge">${this.escape(this._repoName)}</span>` : "";
    const cards = this._reviews.map((r) => this.buildReviewCard(r)).join("");

    return this.shell(`
      <div class="reviews-screen">
        <div class="screen-header">
          ${repoLabel}
          <span class="count-badge">${this._reviews.length} review${this._reviews.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="review-list">${cards}</div>
        <div class="footer">
          <button class="btn btn-ghost small" onclick="vscode.postMessage({command:'openBrowser'})">Open Dashboard ↗</button>
        </div>
      </div>
    `);
  }

  private buildReviewCard(r: Review): string {
    const statusIcon: Record<string, string> = {
      completed: '<span class="badge badge-green">✓ Completed</span>',
      in_progress: '<span class="badge badge-blue">⟳ Running</span>',
      pending: '<span class="badge badge-gray">◌ Pending</span>',
      failed: '<span class="badge badge-red">✕ Failed</span>',
      skipped: '<span class="badge badge-yellow">⤳ Skipped</span>',
    };

    const counts = this.countBySeverity(r.findings);
    const severityBadges = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([sev, c]) => `<span class="sev-dot" style="background:${SEVERITY_COLOR[sev]}" title="${sev}">${c}</span>`)
      .join("");

    const findingItems = r.findings
      .slice(0, 8)
      .map((f) => this.buildFindingItem(f))
      .join("");

    const more = r.findings.length > 8
      ? `<div class="more-findings">+${r.findings.length - 8} more findings</div>` : "";

    return `
      <div class="review-card">
        <div class="review-header">
          <div class="pr-meta">
            <span class="pr-number">#${r.prNumber}</span>
            ${statusIcon[r.status] ?? statusIcon.completed}
            ${severityBadges}
          </div>
          <div class="pr-title" title="${this.escape(r.prTitle)}">${this.escape(r.prTitle)}</div>
          ${r.durationMs ? `<div class="pr-duration">⏱ ${this.formatDuration(r.durationMs)}</div>` : ""}
        </div>
        ${r.findings.length > 0 ? `<div class="finding-list">${findingItems}${more}</div>` : '<div class="no-findings">No findings — code looks clean!</div>'}
      </div>
    `;
  }

  private buildFindingItem(f: ReviewFinding): string {
    const color = SEVERITY_COLOR[f.severity] ?? "#71717a";
    const agentColor = AGENT_COLOR[f.agentName] ?? "#71717a";
    const lineInfo = f.startLine ? `L${f.startLine}` : "";
    const safeFile = f.file.replace(/'/g, "\\'");

    return `
      <div class="finding-item" onclick="vscode.postMessage({command:'jumpToFile',payload:{file:'${safeFile}',line:${f.startLine ?? 1}}})">
        <div class="finding-left" style="border-left-color:${color}">
          <div class="finding-top">
            <span class="finding-title">${this.escape(f.title)}</span>
            <span class="finding-agent" style="color:${agentColor}">${f.agentName}</span>
          </div>
          <div class="finding-meta">
            <span class="finding-file" title="${this.escape(f.file)}">${this.escape(this.shortPath(f.file))}</span>
            ${lineInfo ? `<span class="finding-line">${lineInfo}</span>` : ""}
          </div>
        </div>
        <div class="sev-pill" style="background:${color}20;color:${color}">${f.severity}</div>
      </div>
    `;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private countBySeverity(findings: ReviewFinding[]) {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) { if (counts[f.severity] !== undefined) counts[f.severity]++; }
    return counts;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  private shortPath(p: string): string {
    const parts = p.replace(/\\/g, "/").split("/");
    return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : p;
  }

  private escape(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  private shell(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>CodeLax</title>
<style>
  :root {
    --bg: var(--vscode-sideBar-background, #0f0f13);
    --surface: var(--vscode-editor-background, #1a1a24);
    --border: var(--vscode-panel-border, #2a2a3a);
    --text: var(--vscode-foreground, #e2e8f0);
    --muted: var(--vscode-descriptionForeground, #64748b);
    --accent: #7c3aed;
    --accent-light: #a78bfa;
    --radius: 8px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    font-size: 12px;
    color: var(--text);
    background: var(--bg);
    height: 100vh;
    overflow-x: hidden;
  }
  .center-screen {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 100vh;
    padding: 24px; text-align: center; gap: 12px;
  }
  .logo-ring {
    width: 72px; height: 72px; border-radius: 50%;
    border: 1.5px solid var(--accent);
    display: flex; align-items: center; justify-content: center;
    color: var(--accent-light); margin-bottom: 4px;
    box-shadow: 0 0 24px rgba(124,58,237,0.2);
  }
  h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
  h3 { font-size: 14px; font-weight: 600; }
  .subtitle { font-size: 11px; color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase; }
  .body-text { font-size: 12px; color: var(--muted); line-height: 1.5; max-width: 220px; }
  .hint { font-size: 10px; color: var(--muted); line-height: 1.6; }
  .error-text { color: #f87171; }
  .error-icon { font-size: 32px; color: #f87171; }
  .empty-icon { color: var(--muted); }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid rgba(124,58,237,0.2);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn {
    padding: 7px 16px; border-radius: var(--radius); border: none;
    font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
  }
  .btn-primary {
    background: var(--accent); color: #fff;
  }
  .btn-primary:hover { background: #6d28d9; }
  .btn-ghost {
    background: transparent; color: var(--muted);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { color: var(--text); border-color: var(--accent); }
  .btn.small { padding: 5px 12px; font-size: 11px; }
  .repo-detected { font-size: 10px; color: var(--muted); background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.2); padding: 3px 10px; border-radius: 20px; }
  .repo-detected code { color: var(--accent-light); font-family: monospace; }
  .repo-detected.warn { background: rgba(234,179,8,0.08); border-color: rgba(234,179,8,0.2); color: #facc15; }

  /* Reviews screen */
  .reviews-screen { padding: 10px 10px 0; display: flex; flex-direction: column; gap: 8px; }
  .screen-header {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 2px; border-bottom: 1px solid var(--border); margin-bottom: 2px;
  }
  .repo-badge {
    font-size: 10px; font-weight: 600; color: var(--accent-light);
    background: rgba(124,58,237,0.12); padding: 2px 8px; border-radius: 20px;
    border: 1px solid rgba(124,58,237,0.25); flex: 1; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .count-badge {
    font-size: 10px; color: var(--muted); white-space: nowrap;
  }
  .review-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
  .review-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    transition: border-color 0.15s;
  }
  .review-card:hover { border-color: rgba(124,58,237,0.3); }
  .review-header { padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .pr-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
  .pr-number { font-size: 10px; color: var(--muted); font-weight: 600; }
  .pr-title {
    font-size: 12px; font-weight: 600; color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pr-duration { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .badge {
    font-size: 9px; font-weight: 700; padding: 1px 6px;
    border-radius: 20px; letter-spacing: 0.3px;
  }
  .badge-green { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
  .badge-blue  { background: rgba(59,130,246,0.12); color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }
  .badge-gray  { background: rgba(107,114,128,0.12); color: #9ca3af; border: 1px solid rgba(107,114,128,0.2); }
  .badge-red   { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .badge-yellow{ background: rgba(234,179,8,0.12); color: #facc15; border: 1px solid rgba(234,179,8,0.2); }
  .sev-dot {
    width: 18px; height: 18px; border-radius: 50%;
    font-size: 9px; font-weight: 800; display: flex;
    align-items: center; justify-content: center; color: #fff;
  }
  .finding-list { display: flex; flex-direction: column; }
  .finding-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 12px; gap: 8px; cursor: pointer;
    border-bottom: 1px solid var(--border); transition: background 0.1s;
  }
  .finding-item:last-child { border-bottom: none; }
  .finding-item:hover { background: rgba(124,58,237,0.06); }
  .finding-left {
    flex: 1; min-width: 0; padding-left: 8px;
    border-left: 2px solid transparent;
  }
  .finding-top { display: flex; align-items: baseline; gap: 6px; justify-content: space-between; }
  .finding-title {
    font-size: 11px; font-weight: 500; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; flex: 1;
  }
  .finding-agent { font-size: 9px; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; }
  .finding-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
  .finding-file { font-size: 10px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .finding-line { font-size: 9px; color: var(--muted); background: var(--border); padding: 1px 4px; border-radius: 3px; }
  .sev-pill { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; white-space: nowrap; }
  .more-findings { font-size: 10px; color: var(--muted); padding: 6px 12px; text-align: center; }
  .no-findings { font-size: 11px; color: var(--muted); padding: 10px 12px; text-align: center; }
  .footer { padding: 10px; display: flex; justify-content: center; }
</style>
</head>
<body>
<script>const vscode = acquireVsCodeApi();</script>
${body}
</body>
</html>`;
  }
}
