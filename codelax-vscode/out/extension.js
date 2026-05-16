"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const api_1 = require("./api");
const diagnostics_1 = require("./diagnostics");
const codelens_1 = require("./codelens");
const sidebar_1 = require("./sidebar");
const statusbar_1 = require("./statusbar");
let refreshTimer;
/** Detect the current git repo owner/name from the workspace. */
async function detectCurrentRepo() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0)
        return null;
    // Try reading .git/config to find remote origin URL
    try {
        const gitConfigUri = vscode.Uri.joinPath(folders[0].uri, ".git", "config");
        const raw = Buffer.from(await vscode.workspace.fs.readFile(gitConfigUri)).toString("utf-8");
        const match = raw.match(/url\s*=\s*.*github\.com[:/]([^/]+)\/([^\s.]+)/i);
        if (match)
            return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
    catch {
        // .git/config not found — fall through
    }
    // Fallback: try to match any connected repo by workspace folder name
    return null;
}
async function activate(ctx) {
    // ─── Providers ──────────────────────────────────────────────────────────────
    const sidebar = new sidebar_1.SidebarProvider(ctx);
    const diagnostics = new diagnostics_1.DiagnosticsProvider(ctx);
    const codelens = new codelens_1.CodeLensProvider(ctx);
    const statusBar = new statusbar_1.StatusBarItem(ctx);
    ctx.subscriptions.push(vscode.window.registerWebviewViewProvider("codelax.sidebar", sidebar, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    // ─── Core refresh logic ─────────────────────────────────────────────────────
    async function refresh() {
        if (!(0, api_1.isConfigured)()) {
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
                repo = detected.repo;
            }
            else {
                // 2. Fallback: fetch user's repos and pick the first one matching workspace name
                const repos = await (0, api_1.fetchRepos)();
                const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "";
                const matched = repos.find((r) => r.name.toLowerCase() === wsName.toLowerCase()) ?? repos[0];
                if (matched) {
                    owner = matched.owner;
                    repo = matched.name;
                }
            }
            if (!owner || !repo) {
                sidebar.setError("Could not detect current repository. Make sure this workspace is a GitHub repo connected to CodeLax.");
                statusBar.setError();
                return;
            }
            const reviews = await (0, api_1.fetchReviews)(owner, repo);
            sidebar.setReviews(reviews, `${owner}/${repo}`);
            diagnostics.update(reviews);
            codelens.update(reviews);
            statusBar.setReviews(reviews);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            sidebar.setError(msg);
            statusBar.setError();
        }
    }
    // ─── Commands ────────────────────────────────────────────────────────────────
    ctx.subscriptions.push(vscode.commands.registerCommand("codelax.refresh", () => refresh()), vscode.commands.registerCommand("codelax.configure", async () => {
        const url = await vscode.window.showInputBox({
            title: "CodeLax Server URL",
            prompt: "Your Vercel deployment URL (e.g. https://code-lax.vercel.app)",
            value: vscode.workspace.getConfiguration("codelax").get("serverUrl"),
            ignoreFocusOut: true,
        });
        if (!url)
            return;
        await vscode.workspace.getConfiguration("codelax").update("serverUrl", url.trim(), true);
        const key = await vscode.window.showInputBox({
            title: "CodeLax Extension API Key",
            prompt: "Paste your API key from Dashboard → Settings → Extension",
            password: true,
            ignoreFocusOut: true,
            placeHolder: "clx_...",
        });
        if (!key)
            return;
        await vscode.workspace.getConfiguration("codelax").update("apiKey", key.trim(), true);
        vscode.window.showInformationMessage("CodeLax configured! Fetching reviews…");
        refresh();
    }), vscode.commands.registerCommand("codelax.openInBrowser", () => {
        vscode.env.openExternal(vscode.Uri.parse(`${vscode.workspace.getConfiguration("codelax").get("serverUrl")}/dashboard/reviews`));
    }), vscode.commands.registerCommand("codelax.jumpToFinding", async (finding) => {
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
            const action = await vscode.window.showInformationMessage(`[${finding.severity.toUpperCase()}] ${finding.title}`, { detail: `${finding.description}\n\nSuggestion: ${finding.suggestion}`, modal: false }, "Copy Fix");
            if (action === "Copy Fix") {
                await vscode.env.clipboard.writeText(finding.suggestion);
                vscode.window.showInformationMessage("Fix copied to clipboard!");
            }
        }
        catch {
            vscode.window.showWarningMessage(`Could not open file: ${finding.file}`);
        }
    }));
    // ─── Auto-refresh ────────────────────────────────────────────────────────────
    function startAutoRefresh() {
        if (refreshTimer)
            clearInterval(refreshTimer);
        const interval = vscode.workspace.getConfiguration("codelax").get("autoRefreshInterval") ?? 60;
        if (interval > 0) {
            refreshTimer = setInterval(refresh, interval * 1000);
        }
    }
    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("codelax")) {
            startAutoRefresh();
            refresh();
        }
    }), vscode.window.onDidChangeVisibleTextEditors(() => {
        // Re-apply decorations when new editors open
        refresh();
    }));
    // ─── Initial load ────────────────────────────────────────────────────────────
    startAutoRefresh();
    await refresh();
}
function deactivate() {
    if (refreshTimer)
        clearInterval(refreshTimer);
}
//# sourceMappingURL=extension.js.map