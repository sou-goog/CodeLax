# CodeLax — AI Code Reviewer for VS Code

Multi-agent AI code review directly in your editor. See findings, inline diagnostics, and trigger reviews without leaving VS Code.

## Features

- **Sidebar Panel** — View all recent AI reviews for your current repo with severity badges and finding details
- **Inline Diagnostics** — Squiggly underlines on affected lines with severity-appropriate colors (Error/Warning/Info)
- **CodeLens** — Clickable annotations above flagged lines showing the finding title and severity
- **Status Bar** — At-a-glance summary of critical/high findings or "Clean" status
- **Jump to Finding** — Click any finding in the sidebar to navigate directly to the file and line
- **Auto-Refresh** — Polls for new reviews at a configurable interval

## Getting Started

1. Install the extension
2. Open the Command Palette → `CodeLax: Configure API Key`
3. Enter your server URL (default: `https://code-lax.vercel.app`)
4. Paste your Extension API Key (get it from **Dashboard → Settings → Extension**)
5. Open a workspace that corresponds to a GitHub repo connected to CodeLax

Reviews will automatically appear in the sidebar whenever a PR is reviewed.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `codelax.serverUrl` | `https://code-lax.vercel.app` | Your CodeLax deployment URL |
| `codelax.apiKey` | — | Extension API key from dashboard |
| `codelax.autoRefreshInterval` | `60` | Refresh interval in seconds (0 to disable) |
| `codelax.showInlineDecorations` | `true` | Show colored line highlights |
| `codelax.minSeverityForDiagnostics` | `medium` | Minimum severity for squiggly underlines |

## Commands

- `CodeLax: Refresh Reviews` — Manually refresh
- `CodeLax: Configure API Key` — Set server URL and API key
- `CodeLax: Open in Browser` — Open the web dashboard

## How It Works

The extension communicates with your CodeLax server via REST API, authenticated with a per-user API key. It fetches the latest reviews and their structured findings (file, line, severity, description, suggestion) and renders them as:

1. VS Code Diagnostics (Problems panel + squiggly lines)
2. Text decorations (colored line highlights with hover details)
3. CodeLens (inline clickable annotations)
4. Sidebar webview (full review list with cards)

## Requirements

- A running CodeLax deployment (Vercel or self-hosted)
- At least one GitHub repository connected to CodeLax
- An Extension API key (generated from Dashboard → Settings)
