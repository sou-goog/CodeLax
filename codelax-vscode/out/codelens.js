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
exports.CodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
const SEVERITY_EMOJI = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
    info: "⚪",
};
class CodeLensProvider {
    constructor(ctx) {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
        this.findingsByFile = new Map();
        this.reviewId = "";
        ctx.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: "file" }, this));
    }
    update(reviews) {
        this.findingsByFile.clear();
        const latest = reviews.find((r) => r.status === "completed");
        if (!latest) {
            this._onDidChangeCodeLenses.fire();
            return;
        }
        this.reviewId = latest.id;
        for (const f of latest.findings) {
            if (!f.file || f.startLine === null)
                continue;
            const list = this.findingsByFile.get(f.file) ?? [];
            list.push(f);
            this.findingsByFile.set(f.file, list);
        }
        this._onDidChangeCodeLenses.fire();
    }
    provideCodeLenses(document) {
        const relPath = vscode.workspace.asRelativePath(document.uri, false);
        const findings = this.findingsByFile.get(relPath) ?? this.findingsByFile.get(document.uri.fsPath);
        if (!findings || findings.length === 0)
            return [];
        // Group by line → one CodeLens per affected line (or per function block)
        const byLine = new Map();
        for (const f of findings) {
            const line = Math.max(0, (f.startLine ?? 1) - 1);
            const list = byLine.get(line) ?? [];
            list.push(f);
            byLine.set(line, list);
        }
        const lenses = [];
        for (const [line, linefindings] of byLine.entries()) {
            // Sort by severity
            linefindings.sort((a, b) => {
                const order = ["critical", "high", "medium", "low", "info"];
                return order.indexOf(a.severity) - order.indexOf(b.severity);
            });
            const top = linefindings[0];
            const label = linefindings.length === 1
                ? `${SEVERITY_EMOJI[top.severity]} CodeLax: ${top.title}`
                : `${SEVERITY_EMOJI[top.severity]} CodeLax: ${linefindings.length} findings (${top.severity} + ${linefindings.length - 1} more)`;
            const range = new vscode.Range(line, 0, line, 0);
            lenses.push(new vscode.CodeLens(range, {
                title: label,
                command: "codelax.jumpToFinding",
                arguments: [top],
                tooltip: `${top.description}\n\nFix: ${top.suggestion}`,
            }));
        }
        return lenses;
    }
}
exports.CodeLensProvider = CodeLensProvider;
//# sourceMappingURL=codelens.js.map