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
exports.StatusBarItem = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarItem {
    constructor(ctx) {
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
    setReviews(reviews) {
        const latest = reviews.find((r) => r.status === "completed");
        if (!latest) {
            this.setIdle();
            return;
        }
        const critical = latest.findings.filter((f) => f.severity === "critical").length;
        const high = latest.findings.filter((f) => f.severity === "high").length;
        const total = latest.findings.length;
        if (critical > 0) {
            this.item.text = `$(shield) CodeLax $(error) ${critical} critical`;
            this.item.color = new vscode.ThemeColor("errorForeground");
        }
        else if (high > 0) {
            this.item.text = `$(shield) CodeLax $(warning) ${high} high`;
            this.item.color = new vscode.ThemeColor("editorWarning.foreground");
        }
        else if (total > 0) {
            this.item.text = `$(shield) CodeLax $(info) ${total} finding${total !== 1 ? "s" : ""}`;
            this.item.color = undefined;
        }
        else {
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
exports.StatusBarItem = StatusBarItem;
//# sourceMappingURL=statusbar.js.map