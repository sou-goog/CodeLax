import { NextResponse, NextRequest } from "next/server";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/bitbucket
 * Handles Bitbucket Pull Request webhook events.
 *
 * Setup: In your Bitbucket repo → Settings → Webhooks → Add webhook
 * URL: https://your-domain.com/api/webhooks/bitbucket
 * Triggers: pullrequest:created, pullrequest:updated
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const event = req.headers.get("x-event-key") ?? "";

    console.log(`Received Bitbucket event: ${event}`);

    const body = JSON.parse(rawBody);

    if (event.startsWith("pullrequest:")) {
      const action = event.replace("pullrequest:", "");
      if (!["created", "updated"].includes(action)) {
        return NextResponse.json({ message: "Action ignored" }, { status: 200 });
      }

      const pr = body.pullrequest;
      const repoData = body.repository;
      const owner = repoData.full_name.split("/")[0];
      const repo = repoData.name;
      const prNumber = pr.id;

      // Look up the repository in DB
      const repository = await prisma.repository.findFirst({
        where: { owner, name: repo, provider: "bitbucket" },
        include: { user: true },
      });

      if (!repository) {
        console.warn(`Bitbucket repo ${owner}/${repo} not found in DB — skipping review`);
        return NextResponse.json({ message: "Repository not connected" }, { status: 200 });
      }

      console.log(`Sending pr.review.requested for Bitbucket ${owner}/${repo} PR#${prNumber}`);

      await inngest.send({
        name: "pr.review.requested",
        data: {
          owner,
          repo,
          prNumber,
          userId: repository.userId,
          action: action === "created" ? "opened" : "synchronize",
          provider: "bitbucket",
          before: null,
          after: pr.source?.commit?.hash ?? null,
        },
      });

      return NextResponse.json({ message: "Review triggered" }, { status: 200 });
    }

    return NextResponse.json({ message: "Event received" }, { status: 200 });
  } catch (error) {
    console.error("Error processing Bitbucket webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
