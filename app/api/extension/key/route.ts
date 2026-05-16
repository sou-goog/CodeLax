import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { randomUUID } from "crypto";

/**
 * GET /api/extension/key
 * Returns the user's existing extension API key, or generates a new one.
 * Auth: Better Auth session cookie (called from the dashboard UI).
 */
export async function GET(req: NextRequest) {
  // Validate session via Better Auth session cookie
  const sessionToken = req.cookies.get("better-auth.session_token")?.value
    ?? req.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  // Return existing key or generate a new one
  let key = session.user.extensionApiKey;
  if (!key) {
    key = `clx_${randomUUID().replace(/-/g, "")}`;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { extensionApiKey: key },
    });
  }

  return NextResponse.json({ key, userId: session.user.id, name: session.user.name });
}

/**
 * DELETE /api/extension/key
 * Revokes and regenerates the extension API key.
 */
export async function DELETE(req: NextRequest) {
  const sessionToken = req.cookies.get("better-auth.session_token")?.value
    ?? req.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.session.findUnique({ where: { token: sessionToken } });
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const newKey = `clx_${randomUUID().replace(/-/g, "")}`;
  await prisma.user.update({
    where: { id: session.userId },
    data: { extensionApiKey: newKey },
  });

  return NextResponse.json({ key: newKey });
}
