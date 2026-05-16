import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function getUserFromApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!key) return null;
  return prisma.user.findUnique({ where: { extensionApiKey: key } });
}

/**
 * GET /api/extension/repos
 * Returns all repositories connected by the authenticated user.
 * Auth: Bearer <extensionApiKey>
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromApiKey(req);
  if (!user) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const repos = await prisma.repository.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      owner: true,
      fullName: true,
      url: true,
      language: true,
      stars: true,
    },
  });

  return NextResponse.json({ repos, user: { name: user.name, email: user.email } });
}
