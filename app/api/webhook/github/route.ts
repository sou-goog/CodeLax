import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { inngest } from "@/inngest/client";

// Verify the webhook is genuinely from GitHub
function verifyGitHubSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
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

  // Only process when a PR is opened or new commits are pushed to it
  if (event === "pull_request" && ["opened", "synchronize"].includes(body.action)) {
    await inngest.send({
      name: "codelax/pr.review.requested",
      data: {
        installationId: body.installation.id,
        repoOwner: body.repository.owner.login,
        repoName: body.repository.name,
        prNumber: body.pull_request.number,
        prTitle: body.pull_request.title,
        diffUrl: body.pull_request.diff_url,
        headSha: body.pull_request.head.sha,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
