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
    logger: {
        level: "debug" as const,
    },
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: [
        getBaseURL(),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
        ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
    ].filter(Boolean) as string[],
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            scope: ["repo", "read:user", "user:email"],
            getUserInfo: async (token) => {
                console.log("[DEBUG] GitHub getUserInfo called, full token keys:", Object.keys(token));
                console.log("[DEBUG] GitHub token values:", JSON.stringify(token, null, 2));
                const res = await fetch("https://api.github.com/user", {
                    headers: { Authorization: `Bearer ${token.accessToken}` },
                });
                console.log("[DEBUG] GitHub /user response status:", res.status);
                if (!res.ok) {
                    const text = await res.text();
                    console.error("[DEBUG] GitHub /user error body:", text);
                    return null;
                }
                const data = await res.json();
                console.log("[DEBUG] GitHub user data:", { id: data.id, login: data.login, email: data.email });
                // Fetch primary email if not present
                let email = data.email;
                if (!email) {
                    const emailRes = await fetch("https://api.github.com/user/emails", {
                        headers: { Authorization: `Bearer ${token.accessToken}` },
                    });
                    if (emailRes.ok) {
                        const emails = await emailRes.json();
                        const primary = emails.find((e: { primary: boolean }) => e.primary);
                        email = primary?.email || emails[0]?.email;
                        console.log("[DEBUG] GitHub email from /user/emails:", email);
                    }
                }
                return {
                    user: {
                        id: String(data.id),
                        name: data.name || data.login,
                        email: email,
                        image: data.avatar_url,
                        emailVerified: !!email,
                    },
                    data,
                };
            },
        },
    },
});