"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { inngest } from "@/inngest/client";

export async function getReviews() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    return await prisma.review.findMany({
        where: { repository: { userId: session.user.id } },
        include: { 
            repository: true,
            findings: true
        },
        orderBy: { createdAt: "desc" },
        take: 50
    });
}

export async function retriggerReview(reviewId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    const review = await prisma.review.findFirst({
        where: { id: reviewId, repository: { userId: session.user.id } },
        include: { repository: true },
    });

    if (!review) throw new Error("Review not found");

    // Parse owner/repo from the PR URL
    const match = review.prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) throw new Error("Invalid PR URL");

    const [, owner, repo] = match;

    await inngest.send({
        name: "pr.review.requested",
        data: {
            owner,
            repo,
            prNumber: review.prNumber,
            userId: session.user.id,
            action: "reopened",
            before: null,
            after: null,
        },
    });

    return { success: true };
}
