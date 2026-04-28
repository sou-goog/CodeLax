import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: [
        "http://localhost:3000",
        "https://codelax.vercel.app",
        // Set this to your current ngrok URL when testing webhooks locally
        ...(process.env.BETTER_AUTH_TRUSTED_ORIGIN
            ? [process.env.BETTER_AUTH_TRUSTED_ORIGIN]
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