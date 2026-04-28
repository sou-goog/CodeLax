import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ 
    connectionString,
    max: 1, // Keep max=1 for serverless/Next.js environment
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);

const prismaClientSingleton = () => {
    return new PrismaClient({ adapter });
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export default prisma;
