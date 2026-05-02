import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prismaClientSingleton = () => {
    if (!process.env.DATABASE_URL) {
        return new PrismaClient({} as any);
    }

    // During Vercel build, the PrismaPg adapter can crash with a 'graph' undefined
    // error when Next.js statically evaluates route modules. Fall back to a plain
    // client so the build can complete; runtime requests will always have a valid pool.
    try {
        const connectionString = process.env.DATABASE_URL;
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
    } catch {
        return new PrismaClient({} as any);
    }
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal || prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export default prisma;
