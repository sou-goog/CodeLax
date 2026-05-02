import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";

const getBaseURL = () => {
    if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
};

export const auth = betterAuth({
    baseURL: getBaseURL(),
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: [
        getBaseURL(),
        ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
        ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
    ],
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            scope: ["repo"]
        },
    },
});