import { NextResponse, NextRequest } from "next/server";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/gitlab
 * Handles GitLab Merge Request webhook events.
 *
 * Setup: In your GitLab repo → Settings → Webhooks → Add webhook
 * URL: https://your-domain.com/api/webhooks/gitlab
 * Trigger: Merge request events
 * Secret Token: Set GITLAB_WEBHOOK_SECRET in env
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify GitLab webhook token
    const secret = process.env.GITLAB_WEBHOOK_SECRET ?? "";
    const headerToken = req.headers.get("x-gitlab-token") ?? "";
    if (secret && headerToken !== secret) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventType = body.object_kind;

    console.log(`Received GitLab event: ${eventType}, action: ${body.object_attributes?.action}`);

    if (eventType === "merge_request") {
      const action = body.object_attributes?.action;
      if (!["open", "reopen", "update"].includes(action)) {
        return NextResponse.json({ message: "Action ignored" }, { status: 200 });
      }

      const project = body.project;
      // GitLab gives namespace/project format
      const pathParts = project.path_with_namespace.split("/");
      const owner = pathParts.slice(0, -1).join("/");
      const repo = pathParts[pathParts.length - 1];
      const mrNumber = body.object_attributes.iid;

      // Look up the repository in DB
      const repository = await prisma.repository.findFirst({
        where: { owner, name: repo, provider: "gitlab" },
        include: { user: true },
      });

      if (!repository) {
        console.warn(`GitLab repo ${owner}/${repo} not found in DB — skipping review`);
        return NextResponse.json({ message: "Repository not connected" }, { status: 200 });
      }

      console.log(`Sending pr.review.requested for GitLab ${owner}/${repo} MR!${mrNumber}`);

      await inngest.send({
        name: "pr.review.requested",
        data: {
          owner,
          repo,
          prNumber: mrNumber,
          userId: repository.userId,
          action: action === "open" ? "opened" : action === "update" ? "synchronize" : "reopened",
          provider: "gitlab",
          before: body.object_attributes.oldrev ?? null,
          after: body.object_attributes.last_commit?.id ?? null,
        },
      });

      return NextResponse.json({ message: "Review triggered" }, { status: 200 });
    }

    return NextResponse.json({ message: "Event received" }, { status: 200 });
  } catch (error) {
    console.error("Error processing GitLab webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
