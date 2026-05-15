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

export async function getTeamById(teamId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const membership = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!membership) throw new Error("Not a team member");

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      repositories: { select: { id: true, fullName: true, language: true, stars: true } },
      _count: { select: { members: true, repositories: true } },
    },
  });

  return team ? { ...team, myRole: membership.role } : null;
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

  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) throw new Error("Team name must be at least 2 characters");
  if (trimmed.length > 50) throw new Error("Team name must be under 50 characters");

  let slug = slugify(trimmed);
  const existing = await prisma.team.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const team = await prisma.team.create({
    data: {
      name: trimmed,
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

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) throw new Error("Invalid email address");
  if (!['admin', 'reviewer', 'viewer'].includes(role)) throw new Error("Invalid role");
  if (trimmedEmail === session.user.email.toLowerCase()) throw new Error("You can't invite yourself");

  // Verify caller is admin
  const membership = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "admin") throw new Error("Only admins can invite");

  // Check if already a member
  const targetUser = await prisma.user.findFirst({ where: { email: { equals: trimmedEmail, mode: "insensitive" } } });
  if (targetUser) {
    const existing = await prisma.team_member.findUnique({
      where: { teamId_userId: { teamId, userId: targetUser.id } },
    });
    if (existing) throw new Error("User is already a member");
  }

  // Check existing invite
  const existingInvite = await prisma.team_invite.findFirst({
    where: { teamId, email: trimmedEmail, expiresAt: { gt: new Date() } },
  });
  if (existingInvite) throw new Error("Invite already pending");

  const invite = await prisma.team_invite.create({
    data: {
      teamId,
      email: trimmedEmail,
      role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    include: { team: { select: { name: true } } },
  });

  // Create a notification for the invitee if they have an account
  if (targetUser) {
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: "team_invite",
        title: `You're invited to team "${invite.team.name}"`,
        message: `${session.user.name} invited you as ${role}. Go to Teams to accept.`,
        link: "/dashboard/teams",
      },
    });
  }

  return invite;
}

export async function getMyPendingInvites() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return prisma.team_invite.findMany({
    where: {
      email: { equals: session.user.email, mode: "insensitive" },
      expiresAt: { gt: new Date() },
    },
    include: { team: { select: { id: true, name: true, slug: true, _count: { select: { members: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingInvitesForTeam(teamId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller || caller.role !== "admin") throw new Error("Only admins can view invites");

  return prisma.team_invite.findMany({
    where: { teamId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptInvite(inviteId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const invite = await prisma.team_invite.findUnique({ where: { id: inviteId } });
  if (!invite) throw new Error("Invalid invite");
  if (invite.expiresAt < new Date()) throw new Error("Invite expired");
  if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) throw new Error("Invite is for a different email");

  // Check not already a member
  const existing = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId: invite.teamId, userId: session.user.id } },
  });
  if (existing) {
    await prisma.team_invite.delete({ where: { id: invite.id } });
    throw new Error("You are already a member of this team");
  }

  await prisma.team_member.create({
    data: { teamId: invite.teamId, userId: session.user.id, role: invite.role },
  });

  await prisma.team_invite.delete({ where: { id: invite.id } });

  return { teamId: invite.teamId };
}

export async function declineInvite(inviteId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const invite = await prisma.team_invite.findUnique({ where: { id: inviteId } });
  if (!invite) throw new Error("Invalid invite");
  if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) throw new Error("Not your invite");

  await prisma.team_invite.delete({ where: { id: invite.id } });
}

export async function cancelInvite(teamId: string, inviteId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller || caller.role !== "admin") throw new Error("Only admins can cancel invites");

  await prisma.team_invite.delete({ where: { id: inviteId } });
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

export async function unassignRepoFromTeam(teamId: string, repositoryId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller || !["admin", "reviewer"].includes(caller.role)) throw new Error("Insufficient permissions");

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { teamId: null },
  });
}

export async function getAssignableRepos(teamId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller || !["admin", "reviewer"].includes(caller.role)) return [];

  // Get all repos owned by team members that aren't already assigned to this team
  const memberIds = (
    await prisma.team_member.findMany({ where: { teamId }, select: { userId: true } })
  ).map((m) => m.userId);

  return prisma.repository.findMany({
    where: {
      userId: { in: memberIds },
      OR: [{ teamId: null }, { teamId: { not: teamId } }],
    },
    select: { id: true, fullName: true, userId: true, user: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });
}

export async function getTeamReviews(teamId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller) throw new Error("Not a team member");

  const repos = await prisma.repository.findMany({
    where: { teamId },
    select: { id: true },
  });

  return prisma.review.findMany({
    where: { repositoryId: { in: repos.map((r) => r.id) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      repository: { select: { fullName: true } },
      _count: { select: { findings: true } },
    },
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

export async function getTeamLeaderboard(teamId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const caller = await prisma.team_member.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
  });
  if (!caller) throw new Error("Not a team member");

  // Get all team members
  const members = await prisma.team_member.findMany({
    where: { teamId },
    include: { user: { select: { id: true, name: true, image: true, email: true } } },
  });

  // Get repos assigned to this team
  const repoIds = (
    await prisma.repository.findMany({ where: { teamId }, select: { id: true, userId: true } })
  );

  // For each member, count reviews and findings on their repos that are in the team
  const leaderboard = await Promise.all(
    members.map(async (m) => {
      const memberRepoIds = repoIds.filter((r) => r.userId === m.userId).map((r) => r.id);

      const [reviewCount, findingCount, lastReview] = await Promise.all([
        memberRepoIds.length > 0
          ? prisma.review.count({ where: { repositoryId: { in: memberRepoIds }, status: "completed" } })
          : Promise.resolve(0),
        memberRepoIds.length > 0
          ? prisma.review_finding.count({ where: { review: { repositoryId: { in: memberRepoIds } } } })
          : Promise.resolve(0),
        memberRepoIds.length > 0
          ? prisma.review.findFirst({
              where: { repositoryId: { in: memberRepoIds } },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            })
          : Promise.resolve(null),
      ]);

      return {
        userId: m.userId,
        name: m.user.name || m.user.email,
        image: m.user.image,
        role: m.role,
        reviews: reviewCount,
        findings: findingCount,
        repos: memberRepoIds.length,
        lastActive: lastReview?.createdAt || null,
      };
    })
  );

  return leaderboard.sort((a, b) => b.reviews - a.reviews || b.findings - a.findings);
}
