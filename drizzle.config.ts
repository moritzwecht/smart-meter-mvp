import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

function databaseUrl(): string {
    // Für Migrationen bevorzugt die direkte (nicht gepoolte) Verbindung.
    const raw =
        process.env.DATABASE_URL_UNPOOLED ??
        process.env.POSTGRES_URL_NON_POOLING ??
        process.env.DATABASE_URL ??
        process.env.POSTGRES_URL ??
        "";
    if (!raw) return raw;
    const url = new URL(raw);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (!isLocal && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
    return url.toString();
}

export default defineConfig({
    schema: "./src/lib/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url: databaseUrl() },
    strict: true,
    verbose: true,
});
