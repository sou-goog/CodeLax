import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

let _handler: ReturnType<typeof toNextJsHandler> | null = null;

function getHandler() {
    if (!_handler) {
        // Lazy import to avoid Prisma PrismaPg 'graph' crash during Vercel build
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { auth } = require("@/lib/auth");
        _handler = toNextJsHandler(auth);
    }
    return _handler;
}

export async function GET(req: NextRequest) {
    return getHandler().GET(req);
}

export async function POST(req: NextRequest) {
    return getHandler().POST(req);
}