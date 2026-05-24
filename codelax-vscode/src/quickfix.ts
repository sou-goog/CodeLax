import * as vscode from "vscode";
import * as path from "path";
import { Review, ReviewFinding } from "./api";

/**
 * Provides VS Code Quick Fix (lightbulb) code actions for CodeLax findings.
 * When a finding has a suggestion, clicking the lightbulb lets the user apply it.
 */
export class QuickFixProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  private findingsByFile = new Map<string, ReviewFinding[]>();
  private workspaceRoot: string;

  constructor(ctx: vscode.ExtensionContext) {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
    ctx.subscriptions.push(
      vscode.languages.registerCodeActionsProvider({ scheme: "file" }, this, {
        providedCodeActionKinds: QuickFixProvider.providedCodeActionKinds,
      })
    );
  }

  update(reviews: Review[]) {
    this.findingsByFile.clear();
    const latest = reviews.find((r) => r.status === "completed");
    if (!latest) return;

    for (const f of latest.findings) {
      if (!f.file || f.startLine === null || !f.suggestion) continue;
      const list = this.findingsByFile.get(f.file) ?? [];
      list.push(f);
      this.findingsByFile.set(f.file, list);
    }
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const relPath = vscode.workspace.asRelativePath(document.uri, false);
    const findings =
      this.findingsByFile.get(relPath) ??
      this.findingsByFile.get(document.uri.fsPath) ??
      [];

    const actions: vscode.CodeAction[] = [];

    for (const f of findings) {
      if (!f.suggestion || f.startLine === null) continue;
      const line = Math.max(0, f.startLine - 1);
      const endLine = f.endLine ? Math.max(line, f.endLine - 1) : line;

      // Only show actions for findings that overlap the current cursor/selection
      if (range.start.line > endLine || range.end.line < line) continue;

      const action = new vscode.CodeAction(
        `CodeLax: Apply fix — ${f.title}`,
        vscode.CodeActionKind.QuickFix
      );
      action.command = {
        title: "Apply CodeLax Fix",
        command: "codelax.applyFix",
        arguments: [f],
      };
      action.diagnostics = [];
      action.isPreferred = f.severity === "critical" || f.severity === "high";
      actions.push(action);
    }

    return actions;
  }
}
