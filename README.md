# CodeLax — AI-Powered Code Review Platform

An intelligent multi-agent AI code review platform that automatically analyzes GitHub pull requests for security vulnerabilities, performance issues, logic bugs, and code quality.

## Architecture

CodeLax uses a **multi-agent pipeline** orchestrated by [Inngest](https://www.inngest.com/):

1. **Planner Agent** — Analyzes the PR and decides which specialist agents to activate
2. **Specialist Agents** — Security, Performance, Logic, and Style agents review the code independently
3. **Critic Agent** — Deduplicates findings, removes false positives, and assigns final severity
4. **Synthesizer Agent** — Produces a formatted markdown review posted as a GitHub PR comment

All agents use **RAG** (Retrieval-Augmented Generation) with Pinecone to understand the broader codebase context.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15, React 19, TypeScript |
| Auth | Better Auth (GitHub OAuth) |
| Database | PostgreSQL (Neon) via Prisma ORM |
| AI | Google Gemini (via Vercel AI SDK) |
| Vector DB | Pinecone (RAG embeddings) |
| Background Jobs | Inngest |
| UI | shadcn/ui, Tailwind CSS, Recharts |

## Features

- **Automated multi-agent code reviews** — triggered on PR open/sync/reopen via GitHub webhooks
- **RAG-powered codebase understanding** — indexes repository files into Pinecone for context-aware reviews
- **Smart agent selection** — planner agent decides which specialists to activate per PR
- **Findings dashboard** — view all reviews with severity, confidence, and agent attribution
- **Contribution analytics** — GitHub contribution graph and monthly activity charts
- **Repository management** — connect/disconnect repos with automatic webhook setup
- **Theme support** — light and dark mode

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database (e.g. Neon)
- Pinecone account
- Google AI API key
- GitHub OAuth app

### Installation

1. Install dependencies:
```bash
bun install
```

2. Copy and configure environment variables:
```bash
cp .env.example .env
```

Required env vars:
- `DATABASE_URL` — PostgreSQL connection string
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `GITHUB_WEBHOOK_SECRET` — Webhook signature verification
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini API key
- `PINECONE_API_KEY` — Pinecone API key
- `NEXT_PUBLIC_APP_BASE_URL` — Your app URL (for webhook callbacks)

3. Set up the database:
```bash
bunx prisma migrate deploy
bunx prisma generate
```

4. Run the development server:
```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
app/                    # Next.js pages and API routes
  (auth)/               # Auth routes (login, webhooks)
  dashboard/            # Dashboard pages (overview, repos, reviews, settings)
  api/inngest/          # Inngest webhook handler
module/                 # Feature modules
  ai/                   # AI agents (planner, security, performance, logic, style, critic, synthesizer)
  auth/                 # Auth components and utilities
  dashboard/            # Dashboard server actions
  github/               # GitHub API integration
  repository/           # Repository management
  review/               # Review queries
  settings/             # User settings
inngest/                # Background job definitions
lib/                    # Shared utilities (auth, db, pinecone)
prisma/                 # Database schema and migrations
components/             # UI components (shadcn/ui)
```
