import * as vscode from "vscode";
import { Review } from "./api";

export class StatusBarItem {
  private item: vscode.StatusBarItem;

  constructor(ctx: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "codelax.refresh";
    this.item.tooltip = "CodeLax — click to refresh";
    ctx.subscriptions.push(this.item);
    this.setIdle();
  }

  setIdle() {
    this.item.text = "$(shield) CodeLax";
    this.item.color = undefined;
    this.item.show();
  }

  setLoading() {
    this.item.text = "$(loading~spin) CodeLax";
    this.item.color = undefined;
    this.item.show();
  }

  setReviews(reviews: Review[]) {
    const latest = reviews.find((r) => r.status === "completed");
    if (!latest) { this.setIdle(); return; }

    const critical = latest.findings.filter((f) => f.severity === "critical").length;
    const high = latest.findings.filter((f) => f.severity === "high").length;
    const total = latest.findings.length;

    if (critical > 0) {
      this.item.text = `$(shield) CodeLax $(error) ${critical} critical`;
      this.item.color = new vscode.ThemeColor("errorForeground");
    } else if (high > 0) {
      this.item.text = `$(shield) CodeLax $(warning) ${high} high`;
      this.item.color = new vscode.ThemeColor("editorWarning.foreground");
    } else if (total > 0) {
      this.item.text = `$(shield) CodeLax $(info) ${total} finding${total !== 1 ? "s" : ""}`;
      this.item.color = undefined;
    } else {
      this.item.text = `$(shield) CodeLax $(check) Clean`;
      this.item.color = new vscode.ThemeColor("terminal.ansiGreen");
    }
    this.item.show();
  }

  setError() {
    this.item.text = "$(shield) CodeLax $(warning)";
    this.item.color = new vscode.ThemeColor("editorWarning.foreground");
    this.item.show();
  }
}
