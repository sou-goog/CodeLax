"""
prepare_data.py
───────────────
Pull verified findings from your Neon DB → clean, balanced CSV for CodeBERT training.

Usage:
    # Requires DATABASE_URL in env or a .env file in the same directory
    python prepare_data.py

    # Override output path
    python prepare_data.py --out my_data.csv

    # Seed synthetic examples if DB has < MIN_ROWS real rows
    python prepare_data.py --seed

Output columns:
    text      – concatenated title + description + suggestion (the model's input)
    label     – integer 0=CRITICAL, 1=HIGH, 2=MEDIUM, 3=LOW
    severity  – human-readable label (kept for inspection)
    source    – "db" | "synthetic"
"""

import os
import re
import argparse
import textwrap
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# ── Config ──────────────────────────────────────────────────────────────────
LABEL_MAP = {"critical": 0, "high": 1, "medium": 2, "low": 3}
VALID_SEVERITIES = set(LABEL_MAP.keys())
MIN_ROWS = 40           # if fewer real rows exist, synthetic seed kicks in
BALANCE_FACTOR = 2.0    # max ratio of majority to minority class (soft cap)

# ── Helpers ─────────────────────────────────────────────────────────────────

def load_env() -> str:
    """Load DATABASE_URL from environment or .env file."""
    load_dotenv()
    url = os.getenv("DATABASE_URL")
    if not url:
        raise EnvironmentError(
            "DATABASE_URL not found.\n"
            "Set it in your shell or create a .env file with:\n"
            "  DATABASE_URL=postgresql://user:pass@host/db"
        )
    return url


def fetch_findings(db_url: str) -> pd.DataFrame:
    """
    Pull verified findings from review_finding joined with review.
    Only completed reviews are included — these are ground-truth verified findings.
    Prisma uses quoted camelCase identifiers in PostgreSQL.
    """
    sql = """
        SELECT
            rf.id,
            rf.severity,
            rf.confidence,
            rf."agentName",
            rf.file,
            rf.title,
            rf.description,
            rf.suggestion,
            rf."startLine",
            r."prTitle"
        FROM review_finding rf
        JOIN review r ON r.id = rf."reviewId"
        WHERE r.status = 'completed'
          AND rf.severity IN ('critical', 'high', 'medium', 'low')
        ORDER BY rf."createdAt" DESC
    """
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        print("[prepare_data] ⚠️  No rows returned from DB (table may be empty).")
        return pd.DataFrame()

    df = pd.DataFrame(list(rows))
    df["severity"] = df["severity"].str.lower()
    df = df[df["severity"].isin(VALID_SEVERITIES)]
    print(f"[prepare_data] Fetched {len(df)} findings from Neon DB.")
    return df



def build_text(row: pd.Series) -> str:
    """
    Combine available fields into a single training text.
    Format mirrors what the CodeBERT tokenizer will see at inference time.
    Max ~512 tokens; we pre-truncate description to 300 chars to stay safe.
    """
    parts = [
        f"[AGENT] {row.get('agentName', 'unknown')}",
        f"[FILE] {row.get('file', '')}",
        f"[TITLE] {row.get('title', '')}",
        f"[DESC] {str(row.get('description', ''))[:300]}",
        f"[FIX] {str(row.get('suggestion', ''))[:200]}",
    ]
    return " ".join(p for p in parts if p.split("] ", 1)[-1].strip())


# ── Synthetic seed data ──────────────────────────────────────────────────────
# These are representative examples per class.
# Each was derived from real code review patterns.
SYNTHETIC_EXAMPLES = [
    # ─ CRITICAL ─
    ("security", "api/auth.ts", "SQL Injection via unsanitized input",
     "User-supplied email is interpolated directly into a SQL query string without parameterization.",
     "Use parameterized query: db.query('SELECT * FROM users WHERE email = $1', [email])",
     "critical"),
    ("security", "lib/upload.ts", "Path traversal in file download endpoint",
     "The filename from the request is used to build a filesystem path without sanitization.",
     "Use path.basename() and validate the resolved path stays within UPLOAD_DIR.",
     "critical"),
    ("security", "api/token.ts", "Hardcoded JWT secret in source code",
     "The JWT signing secret is hardcoded as a string literal, exposing it in version control.",
     "Move to environment variable: process.env.JWT_SECRET",
     "critical"),
    ("security", "middleware/auth.ts", "Missing authorization check on admin route",
     "The /admin/delete endpoint only checks authentication, not role. Any logged-in user can delete records.",
     "Add role check: if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })",
     "critical"),
    # ─ HIGH ─
    ("performance", "api/users.ts", "N+1 query in user list endpoint",
     "Each user in the loop triggers a separate SELECT for their profile, causing linear query growth.",
     "Use include/join: prisma.user.findMany({ include: { profile: true } })",
     "high"),
    ("logic", "utils/parse.ts", "Null reference when API returns empty response",
     "The function accesses data.items[0].name without checking if items is empty.",
     "Add guard: const first = data.items?.[0]; if (!first) return null;",
     "high"),
    ("performance", "app/dashboard.tsx", "Unbounded findMany loads entire table",
     "prisma.review.findMany() with no take limit loads every row as the table grows.",
     "Add pagination: prisma.review.findMany({ take: 50, skip: page * 50 })",
     "high"),
    ("logic", "hooks/useData.ts", "Race condition: setState after unmount",
     "The async fetch resolves after component unmount, triggering setState on an unmounted component.",
     "Track mounted state: let mounted = true; fetch().then(d => { if (mounted) setState(d) }); return () => { mounted = false }",
     "high"),
    # ─ MEDIUM ─
    ("performance", "api/search.ts", "Missing database index on frequently queried field",
     "The email field is queried with WHERE email = $1 on every login but has no index.",
     "Add: @@index([email]) to the Prisma model",
     "medium"),
    ("logic", "lib/date.ts", "Off-by-one error in date range filter",
     "The filter uses < endDate instead of <= endDate, excluding records created on the final day.",
     "Change condition to: where createdAt <= endDate",
     "medium"),
    ("style", "components/Card.tsx", "Magic number used for timeout delay",
     "The number 3000 is used directly without explanation. Its meaning is unclear to readers.",
     "Extract: const NOTIFICATION_TIMEOUT_MS = 3000;",
     "medium"),
    ("security", "api/webhook.ts", "Missing webhook signature verification",
     "The GitHub webhook endpoint does not verify the X-Hub-Signature-256 header.",
     "Add HMAC verification: crypto.timingSafeEqual(sig, expected)",
     "medium"),
    # ─ LOW ─
    ("style", "lib/utils.ts", "Ambiguous single-letter variable name",
     "The parameter 'x' in an exported function gives no indication of its purpose.",
     "Rename to a descriptive name: function processData(inputPayload: DataPayload)",
     "low"),
    ("style", "components/UserCard.tsx", "Unused import statement",
     "The 'useState' import is present but never used in this file.",
     "Remove: import { useState } from 'react'",
     "low"),
    ("style", "api/reviews.ts", "Inconsistent error handling pattern",
     "Some handlers use try/catch, others return raw Promise rejections without error boundaries.",
     "Wrap all async handlers in a consistent error middleware.",
     "low"),
    ("style", "lib/config.ts", "Dead code: unreachable branch",
     "The else branch after an early return is never executed.",
     "Remove the unreachable else block.",
     "low"),
]


def build_synthetic_df() -> pd.DataFrame:
    records = []
    for agent, file, title, desc, suggestion, severity in SYNTHETIC_EXAMPLES:
        row = pd.Series({
            "agentName": agent, "file": file, "title": title,
            "description": desc, "suggestion": suggestion, "severity": severity,
        })
        records.append({
            "text": build_text(row),
            "label": LABEL_MAP[severity],
            "severity": severity,
            "source": "synthetic",
        })
    return pd.DataFrame(records)


# ── Balancing ────────────────────────────────────────────────────────────────

def soft_balance(df: pd.DataFrame) -> pd.DataFrame:
    """
    Upsample minority classes to at most BALANCE_FACTOR × majority class size.
    This avoids the model ignoring rare labels without discarding majority data.
    """
    counts = df["label"].value_counts()
    majority = counts.max()
    target = int(majority / BALANCE_FACTOR)
    parts = []
    for label, count in counts.items():
        subset = df[df["label"] == label]
        if count < target:
            upsampled = subset.sample(target, replace=True, random_state=42)
            parts.append(upsampled)
        else:
            parts.append(subset)
    balanced = pd.concat(parts).sample(frac=1, random_state=42).reset_index(drop=True)
    print(f"[prepare_data] After balancing: {balanced['severity'].value_counts().to_dict()}")
    return balanced


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Export CodeLax findings to training CSV")
    parser.add_argument("--out", default="findings_dataset.csv", help="Output CSV path")
    parser.add_argument("--seed", action="store_true", help="Force-include synthetic seed examples")
    args = parser.parse_args()

    db_url = load_env()

    # 1. Pull real data from Neon
    real_df = fetch_findings(db_url)

    rows_list = []
    if not real_df.empty:
        real_df["text"] = real_df.apply(build_text, axis=1)
        real_df["label"] = real_df["severity"].map(LABEL_MAP)
        real_df["source"] = "db"
        rows_list.append(real_df[["text", "label", "severity", "source"]])

    # 2. Supplement with synthetic data if needed
    if args.seed or len(real_df) < MIN_ROWS:
        synth_df = build_synthetic_df()
        rows_list.append(synth_df)
        if args.seed:
            print(f"[prepare_data] Added {len(synth_df)} synthetic seed examples (--seed flag).")
        else:
            print(f"[prepare_data] DB has < {MIN_ROWS} rows — adding {len(synth_df)} synthetic examples.")

    if not rows_list:
        print("[prepare_data] ❌ No data available. Run with --seed to generate synthetic data.")
        return

    df = pd.concat(rows_list, ignore_index=True)
    df = df.dropna(subset=["text", "label"])
    df["text"] = df["text"].str.strip()
    df = df[df["text"].str.len() > 10]

    # 3. Soft-balance classes
    df = soft_balance(df)

    # 4. Save
    df.to_csv(args.out, index=False)
    print(f"\n[prepare_data] DONE: Saved {len(df)} rows -> {args.out}")
    print(f"  Label distribution:\n{df['severity'].value_counts().to_string()}")
    print(f"  Sources: {df['source'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
