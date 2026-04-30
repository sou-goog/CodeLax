"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";

export async function getReviews() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    return await prisma.review.findMany({
        where: { repository: { userId: session.user.id } },
        include: { repository: true },
        orderBy: { createdAt: "desc" },
        take: 50
    });
}
