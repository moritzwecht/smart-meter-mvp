import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string };

const securityHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: pkg.version,
    },
    poweredByHeader: false,
    async headers() {
        return [
            { source: "/:path*", headers: securityHeaders },
            {
                // Der Service Worker muss immer frisch geladen werden, sonst kommen Updates nicht an.
                source: "/sw.js",
                headers: [
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                    { key: "Service-Worker-Allowed", value: "/" },
                ],
            },
        ];
    },
};

export default nextConfig;
