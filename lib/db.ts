import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Build-time stub: Prisma 7 with engine "client" requires an adapter, so we
// cannot fall back to `new PrismaClient()`.  Return a Proxy that satisfies
// the import but throws a clear message if anything actually queries the DB
// during build (which should never happen for dynamic routes).
function buildTimeStub(): PrismaClient {
    return new Proxy({} as PrismaClient, {
        get(_, prop) {
            if (prop === "then" || prop === "$connect" || prop === "$disconnect") {
                return undefined;
            }
            throw new Error(
                `PrismaClient is not available at build time (accessed .${String(prop)})`
            );
        },
    });
}

const prismaClientSingleton = () => {
    if (!process.env.DATABASE_URL) {
        return buildTimeStub();
    }

    try {
        const connectionString = process.env.DATABASE_URL;
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
    } catch {
        return buildTimeStub();
    }
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal || prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export default prisma;
