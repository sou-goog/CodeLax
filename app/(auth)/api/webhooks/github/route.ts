import { NextResponse, NextRequest } from "next/server";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    try {
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get("x-hub-signature-256") ?? "";
        const event = req.headers.get("x-github-event");

        // Verify webhook signature only if GitHub sent one
        const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
        if (secret && signature && !verifyGitHubSignature(rawBody, signature, secret)) {
            console.error("Invalid webhook signature");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        if (event === "ping") {
            return NextResponse.json({ message: "Pong" }, { status: 200 });
        }

        const body = JSON.parse(rawBody);

        console.log(`Received GitHub event: ${event}, action: ${body.action}`);

        if (event === "pull_request" && ["opened", "synchronize", "reopened"].includes(body.action)) {
            const owner = body.repository.owner.login;
            const repo = body.repository.name;
            const prNumber = body.pull_request.number;

            // Look up the repository + user in DB
            const repository = await prisma.repository.findFirst({
                where: { owner, name: repo },
                include: { user: true }
            });

            if (!repository) {
                console.warn(`Repository ${owner}/${repo} not found in DB — skipping review`);
                return NextResponse.json({ message: "Repository not connected" }, { status: 200 });
            }

            console.log(`Sending pr.review.requested for ${owner}/${repo} PR#${prNumber}`);

            // Send Inngest events
            const events: { name: string; data: Record<string, unknown> }[] = [
                {
                    name: "pr.review.requested",
                    data: {
                        owner,
                        repo,
                        prNumber,
                        userId: repository.userId,
                        action: body.action,
                        before: body.before ?? null,
                        after: body.after ?? null,
                    },
                },
            ];

            // Generate PR description only on new PRs (not on push/reopen)
            if (body.action === "opened") {
                events.push({
                    name: "pr.description.generate",
                    data: { owner, repo, prNumber, userId: repository.userId },
                });
            }

            await inngest.send(events);

            return NextResponse.json({ message: "Review triggered" }, { status: 200 });
        }

        return NextResponse.json({ message: "Event received" }, { status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
