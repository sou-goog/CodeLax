import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Build-time / fallback stub: Prisma 7 with engine "client" requires an
// adapter, so we cannot fall back to `new PrismaClient()`.  Return a deep
// Proxy that lets module-level code (e.g. prismaAdapter) inspect the
// client without throwing.  Actual queries will reject with a clear error.
function buildTimeStub(): PrismaClient {
    const handler: ProxyHandler<object> = {
        get(_, prop) {
            // Prevent Promise-like behaviour
            if (prop === "then") return undefined;
            // No-op lifecycle methods
            if (prop === "$connect" || prop === "$disconnect") return () => Promise.resolve();
            // Symbol / toJSON / inspect access — return undefined silently
            if (typeof prop === "symbol" || prop === "toJSON") return undefined;
            // For any model access (e.g. prisma.user) or method, return a
            // nested proxy whose methods reject with a descriptive error.
            return new Proxy(() => {}, {
                get(__, innerProp) {
                    if (innerProp === "then") return undefined;
                    return () =>
                        Promise.reject(
                            new Error(`PrismaClient stub: cannot query DB (${String(prop)}.${String(innerProp)})`)
                        );
                },
                apply() {
                    return Promise.reject(
                        new Error(`PrismaClient stub: cannot query DB (${String(prop)})`)
                    );
                },
            });
        },
    };
    // @ts-expect-error -- Proxy satisfies PrismaClient at runtime via handler traps
    return new Proxy({}, handler);
}

const prismaClientSingleton = () => {
    if (!process.env.DATABASE_URL) {
        return buildTimeStub();
    }

    try {
        const connectionString = process.env.DATABASE_URL;
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        const client = new PrismaClient({ adapter });
        console.log("[db] PrismaClient initialized with PrismaPg adapter");
        return client;
    } catch (e) {
        console.error("[db] PrismaClient initialization failed, using stub:", e);
        return buildTimeStub();
    }
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal || prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export default prisma;
