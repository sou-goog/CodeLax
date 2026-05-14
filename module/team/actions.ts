"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function getMyTeams() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const memberships = await prisma.team_member.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
          repositories: { select: { id: true, fullName: true } },
          _count: { select: { members: true, repositories: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({ ...m.team, myRole: m.role }));
}

export async function createTeam(name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let slug = slugify(name);
  const existing = await prisma.team.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const team = await prisma.team.create({
    data: {
      name,
      slug,
      members: {
        create: { userId: session.user.id, role: "admin" },
      },
    },
  });

  return team;
}

export async function inviteToTeam(teamId: string, email: string, role: string = "viewer") {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify caller is admin
  const membership = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "admin") throw new Error("Only admins can invite");

  // Check if already a member
  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (targetUser) {
    const existing = await prisma.team_member.findUnique({
      where: { teamId_userId: { teamId, userId: targetUser.id } },
    });
    if (existing) throw new Error("User is already a member");
  }

  // Check existing invite
  const existingInvite = await prisma.team_invite.findFirst({
    where: { teamId, email, expiresAt: { gt: new Date() } },
  });
  if (existingInvite) throw new Error("Invite already pending");

  const invite = await prisma.team_invite.create({
    data: {
      teamId,
      email,
      role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return invite;
}

export async function acceptInvite(token: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const invite = await prisma.team_invite.findUnique({ where: { token } });
  if (!invite) throw new Error("Invalid invite");
  if (invite.expiresAt < new Date()) throw new Error("Invite expired");
  if (invite.email !== session.user.email) throw new Error("Invite is for a different email");

  await prisma.team_member.create({
    data: { teamId: invite.teamId, userId: session.user.id, role: invite.role },
  });

  await prisma.team_invite.delete({ where: { id: invite.id } });

  return { teamId: invite.teamId };
}

export async function updateMemberRole(teamId: string, userId: string, role: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller || caller.role !== "admin") throw new Error("Only admins can change roles");
  if (userId === session.user.id) throw new Error("Cannot change your own role");

  await prisma.team_member.update({
    where: { teamId_userId: { teamId, userId } },
    data: { role },
  });
}

export async function removeMember(teamId: string, userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller || caller.role !== "admin") throw new Error("Only admins can remove members");
  if (userId === session.user.id) throw new Error("Cannot remove yourself");

  await prisma.team_member.delete({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function assignRepoToTeam(teamId: string, repositoryId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller || !["admin", "reviewer"].includes(caller.role)) throw new Error("Insufficient permissions");

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { teamId },
  });
}

export async function getTeamAnalytics(teamId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller) throw new Error("Not a team member");

  const repos = await prisma.repository.findMany({
    where: { teamId },
    select: { id: true, fullName: true },
  });

  const repoIds = repos.map((r) => r.id);

  const [totalReviews, totalFindings, recentReviews] = await Promise.all([
    prisma.review.count({ where: { repositoryId: { in: repoIds } } }),
    prisma.review_finding.count({ where: { review: { repositoryId: { in: repoIds } } } }),
    prisma.review.findMany({
      where: { repositoryId: { in: repoIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { repository: { select: { fullName: true } }, _count: { select: { findings: true } } },
    }),
  ]);

  return { totalReviews, totalFindings, repos, recentReviews };
}
