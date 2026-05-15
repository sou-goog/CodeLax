"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";

export async function getRules(repositoryId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return prisma.review_rule.findMany({
    where: { repositoryId, repository: { userId: session.user.id } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createRule(data: {
  repositoryId: string;
  name: string;
  description: string;
  pattern: string;
  severity: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  if (!data.name.trim()) throw new Error("Rule name is required");
  if (!data.pattern.trim()) throw new Error("Pattern is required");
  if (!["critical", "high", "medium", "low", "info"].includes(data.severity)) throw new Error("Invalid severity");

  // Validate regex
  try {
    new RegExp(data.pattern);
  } catch {
    throw new Error("Invalid regex pattern");
  }

  const repo = await prisma.repository.findFirst({
    where: { id: data.repositoryId, userId: session.user.id },
  });
  if (!repo) throw new Error("Repository not found");

  return prisma.review_rule.create({
    data: { ...data, name: data.name.trim(), pattern: data.pattern.trim(), description: data.description.trim() },
  });
}

export async function updateRule(
  ruleId: string,
  data: Partial<{ name: string; description: string; pattern: string; severity: string; enabled: boolean }>
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const rule = await prisma.review_rule.findFirst({
    where: { id: ruleId, repository: { userId: session.user.id } },
  });
  if (!rule) throw new Error("Rule not found");

  return prisma.review_rule.update({ where: { id: ruleId }, data });
}

export async function deleteRule(ruleId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const rule = await prisma.review_rule.findFirst({
    where: { id: ruleId, repository: { userId: session.user.id } },
  });
  if (!rule) throw new Error("Rule not found");

  return prisma.review_rule.delete({ where: { id: ruleId } });
}

export async function getReposForRules() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return prisma.repository.findMany({
    where: { userId: session.user.id },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
