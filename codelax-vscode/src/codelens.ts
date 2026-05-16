import * as vscode from "vscode";
import { Review, ReviewFinding } from "./api";

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

export class CodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private findingsByFile = new Map<string, ReviewFinding[]>();
  private reviewId = "";

  constructor(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ scheme: "file" }, this)
    );
  }

  update(reviews: Review[]) {
    this.findingsByFile.clear();
    const latest = reviews.find((r) => r.status === "completed");
    if (!latest) { this._onDidChangeCodeLenses.fire(); return; }

    this.reviewId = latest.id;
    for (const f of latest.findings) {
      if (!f.file || f.startLine === null) continue;
      const list = this.findingsByFile.get(f.file) ?? [];
      list.push(f);
      this.findingsByFile.set(f.file, list);
    }
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const relPath = vscode.workspace.asRelativePath(document.uri, false);
    const findings = this.findingsByFile.get(relPath) ?? this.findingsByFile.get(document.uri.fsPath);
    if (!findings || findings.length === 0) return [];

    // Group by line → one CodeLens per affected line (or per function block)
    const byLine = new Map<number, ReviewFinding[]>();
    for (const f of findings) {
      const line = Math.max(0, (f.startLine ?? 1) - 1);
      const list = byLine.get(line) ?? [];
      list.push(f);
      byLine.set(line, list);
    }

    const lenses: vscode.CodeLens[] = [];
    for (const [line, linefindings] of byLine.entries()) {
      // Sort by severity
      linefindings.sort((a, b) => {
        const order = ["critical", "high", "medium", "low", "info"];
        return order.indexOf(a.severity) - order.indexOf(b.severity);
      });

      const top = linefindings[0];
      const label =
        linefindings.length === 1
          ? `${SEVERITY_EMOJI[top.severity]} CodeLax: ${top.title}`
          : `${SEVERITY_EMOJI[top.severity]} CodeLax: ${linefindings.length} findings (${top.severity} + ${linefindings.length - 1} more)`;

      const range = new vscode.Range(line, 0, line, 0);
      lenses.push(
        new vscode.CodeLens(range, {
          title: label,
          command: "codelax.jumpToFinding",
          arguments: [top],
          tooltip: `${top.description}\n\nFix: ${top.suggestion}`,
        })
      );
    }

    return lenses;
  }
}
