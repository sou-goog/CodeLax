import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { reviewPullRequest } from "@/module/ai/actions";

// Verify the webhook is genuinely from GitHub
function verifyGitHubSignature(payload: string, signature: string): boolean {
  if (!signature) return false;
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";

  // Security check — reject anything not from GitHub
  if (!verifyGitHubSignature(payload, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  const body = JSON.parse(payload);

  console.log(`Received GitHub event: ${event}`);

  if (event === "pull_request") {
    const action = body.action;
    const repo = body.repository.full_name;
    const prNumber = body.number;

    const [owner, repoName] = repo.split("/");

    if (action === "opened" || action === "synchronize" || action === "reopened") {
      reviewPullRequest(owner, repoName, prNumber)
        .then(() => console.log(`Review completed for ${repo} #${prNumber}`))
        .catch((error) => console.log(`Review failed for ${repo} #${prNumber}:`, error));
    }
  }

  return NextResponse.json({ ok: true });
}