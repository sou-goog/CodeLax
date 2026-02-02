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
