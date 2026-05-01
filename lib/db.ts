import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prismaClientSingleton = () => {
    // During Vercel build, DATABASE_URL might be undefined.
    // The pg adapter crashes with a 'graph' undefined error in Prisma 7 during static evaluation.
    // We conditionally skip the adapter if the URL is missing.
    if (!process.env.DATABASE_URL) {
        return new PrismaClient({} as any);
    }
    
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal || prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export default prisma;
