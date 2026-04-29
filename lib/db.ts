import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ 
    connectionString,
    max: 10,
    idleTimeoutMillis: 1000, // Very short idle timeout so pg closes it before Neon does
    connectionTimeoutMillis: 30000, // Give Neon 30 seconds to wake up from cold start
});

const adapter = new PrismaPg(pool);

const prismaClientSingleton = () => {
    return new PrismaClient({ adapter });
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Force delete the cached instance so Next.js HMR creates a brand new one with the latest schema
// @ts-ignore
delete globalThis.prismaGlobal;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export default prisma;
