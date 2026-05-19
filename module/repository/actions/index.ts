"use server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getRepositories, createWebhook } from "@/module/github/lib/github";
import { inngest } from "@/inngest/client";

export const fetchRepositories = async (
  page: number = 1,
  perPage: number = 10,
) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  const githubRepos = await getRepositories(page, perPage);
  const dbRepos = await prisma.repository.findMany({
    where: {
      userId: session.user.id,
    },
  });
  const connectedRepoIds = new Set(dbRepos.map((repo) => repo.githubId));

  return githubRepos.map((repo: any) => ({
    ...repo,
    isConnected: connectedRepoIds.has(BigInt(repo.id)),
  }));
};

export const connectRepository = async (
  owner: string,
  repo: string,
  githubId: number,
) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // TODO: CHECK IF USER CAN CONNECT MORE REPO

  const existingRepo = await prisma.repository.findUnique({
    where: {
      githubId: BigInt(githubId),
    },
  });

  if (existingRepo) {
    if (existingRepo.userId !== session.user.id) {
      throw new Error("Repository already connected by another user");
    }
    return;
  }

  const webhook = await createWebhook(owner, repo);

  if (webhook) {
    await prisma.repository.create({
      data: {
        id: `${session.user.id}-${githubId}`,
        githubId: BigInt(githubId),
        name: repo,
        owner,
        fullName: `${owner}/${repo}`,
        url: `https://github.com/${owner}/${repo}`,
        userId: session.user.id,
        updatedAt: new Date(),
      },
    });
  }

  try {
    await inngest.send({
      name: "github/index.repo",
      data: {
        owner,
        repo,
        userId: session.user.id,
      },
    });
  } catch (error) {
    console.error("Failed to trigger repository indexing:", error);
  }
  return webhook;
};

// ─── GitLab Repositories ─────────────────────────────────────────────────────

export const fetchGitLabRepositories = async (page: number = 1, perPage: number = 20) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "gitlab" },
  });
  if (!account?.accessToken) return [];

  const res = await fetch(
    `https://gitlab.com/api/v4/projects?membership=true&order_by=updated_at&sort=desc&page=${page}&per_page=${perPage}`,
    { headers: { "PRIVATE-TOKEN": account.accessToken } }
  );
  if (!res.ok) return [];
  const projects = await res.json();

  const dbRepos = await prisma.repository.findMany({
    where: { userId: session.user.id, provider: "gitlab" },
  });
  const connectedPaths = new Set(dbRepos.map((r) => r.fullName));

  return projects.map((p: any) => ({
    id: p.id,
    name: p.path,
    full_name: p.path_with_namespace,
    description: p.description,
    language: p.predominant_language ?? null,
    stargazers_count: p.star_count,
    html_url: p.web_url,
    private: p.visibility === "private",
    owner: { login: p.namespace?.full_path ?? p.path_with_namespace.split("/").slice(0, -1).join("/") },
    isConnected: connectedPaths.has(p.path_with_namespace),
    provider: "gitlab" as const,
  }));
};

export const fetchBitbucketRepositories = async (page: number = 1, perPage: number = 20) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "bitbucket" },
  });
  if (!account?.accessToken) return [];

  const res = await fetch(
    `https://api.bitbucket.org/2.0/repositories?role=member&pagelen=${perPage}&page=${page}`,
    { headers: { Authorization: `Bearer ${account.accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();

  const dbRepos = await prisma.repository.findMany({
    where: { userId: session.user.id, provider: "bitbucket" },
  });
  const connectedPaths = new Set(dbRepos.map((r) => r.fullName));

  return (data.values ?? []).map((r: any) => ({
    id: r.uuid,
    name: r.slug,
    full_name: r.full_name,
    description: r.description,
    language: r.language ?? null,
    stargazers_count: 0,
    html_url: r.links?.html?.href ?? "",
    private: r.is_private,
    owner: { login: r.full_name.split("/")[0] },
    isConnected: connectedPaths.has(r.full_name),
    provider: "bitbucket" as const,
  }));
};

// ─── Connect external (GitLab/Bitbucket) repository ──────────────────────────

export const connectExternalRepository = async (
  owner: string,
  repo: string,
  fullName: string,
  provider: "gitlab" | "bitbucket",
  externalId: string,
  url: string,
) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.repository.findFirst({
    where: { fullName, provider },
  });

  if (existing) {
    if (existing.userId !== session.user.id) {
      throw new Error("Repository already connected by another user");
    }
    return { success: true, existing: true };
  }

  await prisma.repository.create({
    data: {
      id: `${session.user.id}-${provider}-${externalId}`,
      name: repo,
      owner,
      fullName,
      url,
      provider,
      userId: session.user.id,
      updatedAt: new Date(),
    },
  });

  return { success: true };
};
