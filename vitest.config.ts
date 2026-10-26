import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            // `server-only` wirft außerhalb von React-Server-Umgebungen – in Tests ist das egal.
            "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        testTimeout: 30_000,
        // Wie beim Nutzer: Zeitzone Europe/Berlin (relevant für Datums-/Monatsgrenzen)
        env: { TZ: "Europe/Berlin" },
        hookTimeout: 60_000,
    },
});
