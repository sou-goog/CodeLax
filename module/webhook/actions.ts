"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { Octokit } from "octokit";

export interface WebhookInfo {
  repoFullName: string;
  webhookId: number | null;
  active: boolean;
  events: string[];
  lastDelivery: string | null;
  recentDeliveries: WebhookDelivery[];
  successRate: number;
}

export interface WebhookDelivery {
  id: number;
  guid: string;
  event: string;
  action: string | null;
  statusCode: number;
  success: boolean;
  deliveredAt: string;
  duration: number;
}

export async function getWebhookHealth(): Promise<WebhookInfo[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "github" },
  });
  if (!account?.accessToken) throw new Error("No GitHub token");

  const repos = await prisma.repository.findMany({
    where: { userId: session.user.id },
  });

  const octokit = new Octokit({ auth: account.accessToken });
  const results: WebhookInfo[] = [];

  for (const repo of repos) {
    const [owner, name] = repo.fullName.split("/");
    if (!owner || !name) continue;

    try {
      const { data: hooks } = await octokit.rest.repos.listWebhooks({ owner, repo: name });

      // Find our webhook (matches our webhook URL pattern)
      const ourHook = hooks.find(
        (h) => h.config?.url?.includes("codelax") || h.config?.url?.includes("inngest") || h.events?.includes("pull_request")
      );

      if (!ourHook) {
        results.push({
          repoFullName: repo.fullName,
          webhookId: null,
          active: false,
          events: [],
          lastDelivery: null,
          recentDeliveries: [],
          successRate: 0,
        });
        continue;
      }

      // Fetch recent deliveries
      let deliveries: WebhookDelivery[] = [];
      try {
        const { data: rawDeliveries } = await octokit.rest.repos.listWebhookDeliveries({
          owner,
          repo: name,
          hook_id: ourHook.id,
          per_page: 10,
        });

        deliveries = rawDeliveries.map((d: any) => ({
          id: d.id,
          guid: d.guid,
          event: d.event,
          action: d.action,
          statusCode: d.status_code,
          success: d.status === "OK",
          deliveredAt: d.delivered_at,
          duration: d.duration,
        }));
      } catch (e) {
        // Deliveries API might not be available for all repos
      }

      const successCount = deliveries.filter((d) => d.success).length;
      const successRate = deliveries.length > 0 ? (successCount / deliveries.length) * 100 : 100;

      results.push({
        repoFullName: repo.fullName,
        webhookId: ourHook.id,
        active: ourHook.active,
        events: ourHook.events || [],
        lastDelivery: ourHook.last_response?.message || null,
        recentDeliveries: deliveries,
        successRate: Math.round(successRate),
      });
    } catch (e) {
      // If we can't list hooks (permissions), still show the repo
      results.push({
        repoFullName: repo.fullName,
        webhookId: null,
        active: false,
        events: [],
        lastDelivery: null,
        recentDeliveries: [],
        successRate: 0,
      });
    }
  }

  return results;
}

export async function pingWebhook(repoFullName: string, webhookId: number): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "github" },
  });
  if (!account?.accessToken) throw new Error("No GitHub token");

  const [owner, repo] = repoFullName.split("/");
  const octokit = new Octokit({ auth: account.accessToken });

  try {
    await octokit.rest.repos.pingWebhook({ owner, repo, hook_id: webhookId });
    return true;
  } catch {
    return false;
  }
}
