import * as vscode from "vscode";
import * as path from "path";
import { Review, ReviewFinding } from "./api";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

const DIAGNOSTIC_SEVERITY: Record<string, vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  high: vscode.DiagnosticSeverity.Error,
  medium: vscode.DiagnosticSeverity.Warning,
  low: vscode.DiagnosticSeverity.Information,
  info: vscode.DiagnosticSeverity.Hint,
};

/** Text decorations — subtle colored background on affected lines */
const decorationTypes: Record<string, vscode.TextEditorDecorationType> = {
  critical: vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(239,68,68,0.08)",
    border: "0 0 0 2px rgba(239,68,68,0.6)",
    isWholeLine: true,
    overviewRulerColor: "rgba(239,68,68,0.8)",
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  }),
  high: vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(249,115,22,0.07)",
    border: "0 0 0 2px rgba(249,115,22,0.5)",
    isWholeLine: true,
    overviewRulerColor: "rgba(249,115,22,0.7)",
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  }),
  medium: vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(234,179,8,0.06)",
    border: "0 0 0 2px rgba(234,179,8,0.4)",
    isWholeLine: true,
    overviewRulerColor: "rgba(234,179,8,0.6)",
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  }),
  low: vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(99,102,241,0.05)",
    border: "0 0 0 2px rgba(99,102,241,0.3)",
    isWholeLine: true,
  }),
};

export class DiagnosticsProvider {
  private collection: vscode.DiagnosticCollection;
  private workspaceRoot: string;

  constructor(ctx: vscode.ExtensionContext) {
    this.collection = vscode.languages.createDiagnosticCollection("codelax");
    ctx.subscriptions.push(this.collection);
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  }

  update(reviews: Review[]) {
    this.collection.clear();
    this.clearDecorations();

    const cfg = vscode.workspace.getConfiguration("codelax");
    const minSev = cfg.get<string>("minSeverityForDiagnostics") ?? "medium";
    const showDecorations = cfg.get<boolean>("showInlineDecorations") ?? true;
    const minSevIndex = SEVERITY_ORDER.indexOf(minSev);

    // Latest completed review only
    const latest = reviews.find((r) => r.status === "completed");
    if (!latest) return;

    // Group findings by file
    const byFile = new Map<string, ReviewFinding[]>();
    for (const f of latest.findings) {
      if (!f.file || f.startLine === null) continue;
      const sevIndex = SEVERITY_ORDER.indexOf(f.severity);
      if (sevIndex > minSevIndex) continue; // below threshold
      const list = byFile.get(f.file) ?? [];
      list.push(f);
      byFile.set(f.file, list);
    }

    // Create diagnostics for each file
    for (const [filePath, findings] of byFile.entries()) {
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.workspaceRoot, filePath);
      const uri = vscode.Uri.file(absPath);

      const diagnostics: vscode.Diagnostic[] = findings.map((f) => {
        const line = Math.max(0, (f.startLine ?? 1) - 1);
        const endLine = f.endLine ? Math.max(line, f.endLine - 1) : line;
        const range = new vscode.Range(line, 0, endLine, 9999);

        const diag = new vscode.Diagnostic(
          range,
          `[CodeLax ${f.severity.toUpperCase()}] ${f.title}\n${f.description}`,
          DIAGNOSTIC_SEVERITY[f.severity] ?? vscode.DiagnosticSeverity.Information
        );
        diag.source = `CodeLax (${f.agentName})`;
        diag.code = { value: f.id, target: vscode.Uri.parse(`${f.id}`) };
        return diag;
      });

      this.collection.set(uri, diagnostics);
    }

    // Apply decorations to currently open editors
    if (showDecorations) {
      this.applyDecorations(byFile);
    }
  }

  private applyDecorations(byFile: Map<string, ReviewFinding[]>) {
    for (const editor of vscode.window.visibleTextEditors) {
      const relPath = vscode.workspace.asRelativePath(editor.document.uri, false);
      const findings = byFile.get(relPath) ?? byFile.get(editor.document.uri.fsPath) ?? [];

      // Group by severity
      const bySeverity = new Map<string, vscode.DecorationOptions[]>();
      for (const f of findings) {
        if (f.startLine === null) continue;
        const line = Math.max(0, f.startLine - 1);
        const options: vscode.DecorationOptions = {
          range: new vscode.Range(line, 0, line, 0),
          hoverMessage: new vscode.MarkdownString(
            `**[CodeLax ${f.severity.toUpperCase()}]** ${f.title}\n\n${f.description}\n\n**Fix:** \`${f.suggestion}\``
          ),
        };
        const list = bySeverity.get(f.severity) ?? [];
        list.push(options);
        bySeverity.set(f.severity, list);
      }

      // Apply each severity's decoration type
      for (const [sev, type] of Object.entries(decorationTypes)) {
        editor.setDecorations(type, bySeverity.get(sev) ?? []);
      }
    }
  }

  private clearDecorations() {
    for (const editor of vscode.window.visibleTextEditors) {
      for (const type of Object.values(decorationTypes)) {
        editor.setDecorations(type, []);
      }
    }
  }

  dispose() {
    this.collection.dispose();
    for (const type of Object.values(decorationTypes)) {
      type.dispose();
    }
  }
}
