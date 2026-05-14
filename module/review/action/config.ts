"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { Octokit } from "octokit";
import type { CodeLaxConfig } from "@/module/ai/lib/config";

export async function getConnectedRepos() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return await prisma.repository.findMany({
    where: { userId: session.user.id },
    select: { id: true, fullName: true, name: true, owner: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getRepoConfig(repositoryId: string): Promise<{ config: CodeLaxConfig; exists: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, userId: session.user.id },
  });
  if (!repo) throw new Error("Repository not found");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "github" },
  });
  if (!account?.accessToken) throw new Error("No GitHub token");

  const octokit = new Octokit({ auth: account.accessToken });

  const defaultConfig: CodeLaxConfig = {
    agents: ["security", "performance", "logic", "style"],
    ignore: [],
    minSeverity: "medium",
    maxInlineComments: 5,
    instructions: [],
    autoDescription: true,
  };

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: repo.owner,
      repo: repo.name,
      path: ".codelax.yaml",
    });

    if ("content" in data && data.type === "file") {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      // Parse inline using the same logic
      const config = parseYamlConfig(content);
      return { config, exists: true };
    }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) {
      return { config: defaultConfig, exists: false };
    }
  }

  return { config: defaultConfig, exists: false };
}

export async function saveRepoConfig(repositoryId: string, config: CodeLaxConfig): Promise<{ success: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, userId: session.user.id },
  });
  if (!repo) throw new Error("Repository not found");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "github" },
  });
  if (!account?.accessToken) throw new Error("No GitHub token");

  const octokit = new Octokit({ auth: account.accessToken });
  const yaml = configToYaml(config);

  // Check if file exists
  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: repo.owner,
      repo: repo.name,
      path: ".codelax.yaml",
    });
    if ("sha" in data) sha = data.sha;
  } catch {
    // File doesn't exist yet
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: repo.owner,
    repo: repo.name,
    path: ".codelax.yaml",
    message: "chore: update CodeLax config via dashboard",
    content: Buffer.from(yaml).toString("base64"),
    ...(sha ? { sha } : {}),
  });

  return { success: true };
}

function configToYaml(config: CodeLaxConfig): string {
  const lines: string[] = [
    "# CodeLax AI Review Configuration",
    "# Docs: https://github.com/sou-goog/CodeLax",
    "",
  ];

  if (config.agents?.length) {
    lines.push("agents:");
    for (const a of config.agents) lines.push(`  - ${a}`);
    lines.push("");
  }

  if (config.ignore?.length) {
    lines.push("ignore:");
    for (const p of config.ignore) lines.push(`  - "${p}"`);
    lines.push("");
  }

  lines.push(`minSeverity: ${config.minSeverity || "medium"}`);
  lines.push(`maxInlineComments: ${config.maxInlineComments ?? 5}`);
  lines.push(`autoDescription: ${config.autoDescription !== false}`);
  lines.push("");

  if (config.instructions?.length) {
    lines.push("instructions:");
    for (const i of config.instructions) lines.push(`  - "${i}"`);
    lines.push("");
  }

  return lines.join("\n");
}

function parseYamlConfig(yamlContent: string): CodeLaxConfig {
  const config: CodeLaxConfig = {
    agents: [],
    ignore: [],
    minSeverity: "medium",
    maxInlineComments: 5,
    instructions: [],
    autoDescription: true,
  };

  const lines = yamlContent.split("\n");
  let currentKey = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const keyMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      currentKey = key;
      if (key === "minSeverity" && value) config.minSeverity = value.trim() as CodeLaxConfig["minSeverity"];
      else if (key === "maxInlineComments" && value) config.maxInlineComments = parseInt(value.trim(), 10) || 5;
      else if (key === "autoDescription") config.autoDescription = value.trim() !== "false";
      continue;
    }

    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (listMatch && currentKey) {
      const item = listMatch[1].trim().replace(/^["']|["']$/g, "");
      if (currentKey === "agents") config.agents!.push(item as "security" | "performance" | "logic" | "style");
      else if (currentKey === "ignore") config.ignore!.push(item);
      else if (currentKey === "instructions") config.instructions!.push(item);
    }
  }

  return config;
}
