import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    allowedDevOrigins: [
        "unspiring-ulysses-grubbily.ngrok-free.dev",
    ],
};

export default nextConfig;
