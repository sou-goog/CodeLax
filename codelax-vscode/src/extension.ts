import * as vscode from "vscode";
import * as path from "path";
import { fetchReviews, fetchRepos, isConfigured, Review, ReviewFinding } from "./api";
import { DiagnosticsProvider } from "./diagnostics";
import { CodeLensProvider } from "./codelens";
import { SidebarProvider } from "./sidebar";
import { StatusBarItem } from "./statusbar";

let refreshTimer: ReturnType<typeof setInterval> | undefined;

/** Detect the current git repo owner/name from the workspace. */
async function detectCurrentRepo(): Promise<{ owner: string; repo: string } | null> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;

  // Try reading .git/config to find remote origin URL
  try {
    const gitConfigUri = vscode.Uri.joinPath(folders[0].uri, ".git", "config");
    const raw = Buffer.from(await vscode.workspace.fs.readFile(gitConfigUri)).toString("utf-8");
    const match = raw.match(/url\s*=\s*.*github\.com[:/]([^/]+)\/([^\s.]+)/i);
    if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  } catch {
    // .git/config not found — fall through
  }

  // Fallback: try to match any connected repo by workspace folder name
  return null;
}

export async function activate(ctx: vscode.ExtensionContext) {
  // ─── Providers ──────────────────────────────────────────────────────────────
  const sidebar    = new SidebarProvider(ctx);
  const diagnostics = new DiagnosticsProvider(ctx);
  const codelens   = new CodeLensProvider(ctx);
  const statusBar  = new StatusBarItem(ctx);

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codelax.sidebar", sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ─── Core refresh logic ─────────────────────────────────────────────────────
  async function refresh() {
    if (!isConfigured()) {
      sidebar.setLoading(false);
      return;
    }

    sidebar.setLoading(true);
    statusBar.setLoading();

    try {
      let owner = "", repo = "";

      // 1. Try detecting from git config
      const detected = await detectCurrentRepo();
      if (detected) {
        owner = detected.owner;
        repo  = detected.repo;
      } else {
        // 2. Fallback: fetch user's repos and pick the first one matching workspace name
        const repos = await fetchRepos();
        const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "";
        const matched = repos.find(
          (r) => r.name.toLowerCase() === wsName.toLowerCase()
        ) ?? repos[0];
        if (matched) { owner = matched.owner; repo = matched.name; }
      }

      if (!owner || !repo) {
        sidebar.setError("Could not detect current repository. Make sure this workspace is a GitHub repo connected to CodeLax.");
        statusBar.setError();
        return;
      }

      const reviews = await fetchReviews(owner, repo);
      sidebar.setReviews(reviews, `${owner}/${repo}`);
      diagnostics.update(reviews);
      codelens.update(reviews);
      statusBar.setReviews(reviews);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sidebar.setError(msg);
      statusBar.setError();
    }
  }

  // ─── Commands ────────────────────────────────────────────────────────────────
  ctx.subscriptions.push(
    vscode.commands.registerCommand("codelax.refresh", () => refresh()),

    vscode.commands.registerCommand("codelax.configure", async () => {
      const url = await vscode.window.showInputBox({
        title: "CodeLax Server URL",
        prompt: "Your Vercel deployment URL (e.g. https://code-lax.vercel.app)",
        value: vscode.workspace.getConfiguration("codelax").get("serverUrl"),
        ignoreFocusOut: true,
      });
      if (!url) return;
      await vscode.workspace.getConfiguration("codelax").update("serverUrl", url.trim(), true);

      const key = await vscode.window.showInputBox({
        title: "CodeLax Extension API Key",
        prompt: "Paste your API key from Dashboard → Settings → Extension",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "clx_...",
      });
      if (!key) return;
      await vscode.workspace.getConfiguration("codelax").update("apiKey", key.trim(), true);

      vscode.window.showInformationMessage("CodeLax configured! Fetching reviews…");
      refresh();
    }),

    vscode.commands.registerCommand("codelax.openInBrowser", () => {
      vscode.env.openExternal(
        vscode.Uri.parse(
          `${vscode.workspace.getConfiguration("codelax").get("serverUrl")}/dashboard/reviews`
        )
      );
    }),

    vscode.commands.registerCommand("codelax.jumpToFinding", async (finding: ReviewFinding) => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
      const absPath = path.isAbsolute(finding.file)
        ? finding.file
        : path.join(root, finding.file);
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
        const line = Math.max(0, (finding.startLine ?? 1) - 1);
        await vscode.window.showTextDocument(doc, {
          selection: new vscode.Range(line, 0, line, 0),
        });

        // Show quick pick with details
        const action = await vscode.window.showInformationMessage(
          `[${finding.severity.toUpperCase()}] ${finding.title}`,
          { detail: `${finding.description}\n\nSuggestion: ${finding.suggestion}`, modal: false },
          "Copy Fix"
        );
        if (action === "Copy Fix") {
          await vscode.env.clipboard.writeText(finding.suggestion);
          vscode.window.showInformationMessage("Fix copied to clipboard!");
        }
      } catch {
        vscode.window.showWarningMessage(`Could not open file: ${finding.file}`);
      }
    })
  );

  // ─── Auto-refresh ────────────────────────────────────────────────────────────
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    const interval = vscode.workspace.getConfiguration("codelax").get<number>("autoRefreshInterval") ?? 60;
    if (interval > 0) {
      refreshTimer = setInterval(refresh, interval * 1000);
    }
  }

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("codelax")) {
        startAutoRefresh();
        refresh();
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      // Re-apply decorations when new editors open
      refresh();
    })
  );

  // ─── Initial load ────────────────────────────────────────────────────────────
  startAutoRefresh();
  await refresh();
}

export function deactivate() {
  if (refreshTimer) clearInterval(refreshTimer);
}
