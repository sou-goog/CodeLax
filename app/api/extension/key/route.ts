import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";

async function getSessionUser(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

/**
 * GET /api/extension/key
 * Returns the user's existing extension API key, or generates a new one.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let key = user.extensionApiKey;
  if (!key) {
    key = `clx_${randomUUID().replace(/-/g, "")}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { extensionApiKey: key },
    });
  }

  return NextResponse.json({ key, userId: user.id, name: user.name });
}

/**
 * DELETE /api/extension/key
 * Revokes and regenerates the extension API key.
 */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const newKey = `clx_${randomUUID().replace(/-/g, "")}`;
  await prisma.user.update({
    where: { id: user.id },
    data: { extensionApiKey: newKey },
  });

  return NextResponse.json({ key: newKey });
}
