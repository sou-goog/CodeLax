"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";

export async function getActivityFeed(options?: {
  type?: string;
  limit?: number;
  cursor?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const limit = options?.limit || 30;

  const events = await prisma.activity_event.findMany({
    where: {
      userId: session.user.id,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.cursor ? { createdAt: { lt: new Date(options.cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { user: { select: { name: true, image: true } } },
  });

  const hasMore = events.length > limit;
  const items = events.slice(0, limit);

  return {
    events: items.map((e) => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
    })),
    hasMore,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

export async function logActivity(data: {
  userId: string;
  type: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}) {
  return prisma.activity_event.create({
    data: {
      userId: data.userId,
      type: data.type,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: data.metadata ? JSON.stringify(data.metadata) : "{}",
    },
  });
}
