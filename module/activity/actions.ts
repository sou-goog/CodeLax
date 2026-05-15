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

  // Get team member IDs so we can show team activity too
  const teamIds = (
    await prisma.team_member.findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
    })
  ).map((m) => m.teamId);

  let teamMemberIds: string[] = [];
  if (teamIds.length > 0) {
    teamMemberIds = (
      await prisma.team_member.findMany({
        where: { teamId: { in: teamIds } },
        select: { userId: true },
      })
    ).map((m) => m.userId);
  }

  const userIds = [...new Set([session.user.id, ...teamMemberIds])];

  const events = await prisma.activity_event.findMany({
    where: {
      userId: { in: userIds },
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

export async function backfillActivity() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Check if already backfilled
  const existing = await prisma.activity_event.count({
    where: { userId: session.user.id },
  });
  if (existing > 0) return { created: 0, message: "Already has activity events" };

  // Get all completed reviews for this user's repos
  const reviews = await prisma.review.findMany({
    where: { repository: { userId: session.user.id }, status: "completed" },
    include: { repository: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Create activity events from reviews
  const events = reviews.map((r) => ({
    userId: session.user.id,
    type: "review",
    action: `Review completed for ${r.repository.fullName}#${r.prNumber}`,
    targetType: "review",
    targetId: r.id,
    metadata: JSON.stringify({
      name: r.prTitle,
      description: `${r.repository.fullName}#${r.prNumber}`,
      prNumber: r.prNumber,
      repo: r.repository.fullName,
    }),
    createdAt: r.completedAt || r.createdAt,
  }));

  if (events.length > 0) {
    await prisma.activity_event.createMany({ data: events });
  }

  // Also log repo connections
  const repos = await prisma.repository.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const repoEvents = repos.map((r) => ({
    userId: session.user.id,
    type: "repo",
    action: `Connected repository ${r.fullName}`,
    targetType: "repository",
    targetId: r.id,
    metadata: JSON.stringify({ name: r.fullName }),
    createdAt: r.createdAt,
  }));

  if (repoEvents.length > 0) {
    await prisma.activity_event.createMany({ data: repoEvents });
  }

  return { created: events.length + repoEvents.length };
}
