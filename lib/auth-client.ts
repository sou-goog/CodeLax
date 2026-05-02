import { createAuthClient } from "better-auth/react";

export const { signIn, signUp, useSession, signOut } = createAuthClient({
    baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
});
