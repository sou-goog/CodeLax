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
exports.fetchReviews = fetchReviews;
exports.fetchRepos = fetchRepos;
exports.isConfigured = isConfigured;
exports.getServerUrl = getServerUrl;
const vscode = __importStar(require("vscode"));
function getConfig() {
    const cfg = vscode.workspace.getConfiguration("codelax");
    return {
        serverUrl: (cfg.get("serverUrl") ?? "https://code-lax.vercel.app").replace(/\/$/, ""),
        apiKey: cfg.get("apiKey") ?? "",
    };
}
async function apiFetch(path) {
    const { serverUrl, apiKey } = getConfig();
    if (!apiKey)
        throw new Error("No API key configured. Run 'CodeLax: Configure API Key'.");
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
    return res.json();
}
async function fetchReviews(owner, repo, limit = 20) {
    const data = await apiFetch(`/api/extension/reviews?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&limit=${limit}`);
    return data.reviews ?? [];
}
async function fetchRepos() {
    const data = await apiFetch("/api/extension/repos");
    return data.repos ?? [];
}
function isConfigured() {
    const { apiKey } = getConfig();
    return apiKey.length > 0;
}
function getServerUrl() {
    return getConfig().serverUrl;
}
//# sourceMappingURL=api.js.map