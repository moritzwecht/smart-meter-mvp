import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";

export const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle");

export async function createEmptyDb() {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    return { client, db };
}

/** Frische Datenbank mit allen Migrationen – entspricht einer Neuinstallation. */
export async function createMigratedDb() {
    const { client, db } = await createEmptyDb();
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    return { client, db };
}

/** Führt eine Migrationsdatei Statement für Statement aus (für Legacy-Szenarien). */
export async function runSqlFile(client: PGlite, file: string) {
    const content = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const stmt of content.split("--> statement-breakpoint")) {
        if (stmt.trim()) await client.exec(stmt);
    }
}

let shared: Promise<Awaited<ReturnType<typeof createMigratedDb>>> | undefined;

/**
 * Migrierte Datenbank, die innerhalb eines Test-Workers wiederverwendet und vor
 * jedem Test geleert wird (Migrationen nur einmal pro Datei → schnelle Tests).
 */
export async function getCleanDb() {
    shared ??= createMigratedDb();
    const instance = await shared;
    const { rows } = await instance.client.query<{ tablename: string }>(
        `select tablename from pg_tables where schemaname = 'public'`,
    );
    if (rows.length) {
        await instance.client.exec(`truncate ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`);
    }
    return instance;
}

export type TestDb = Awaited<ReturnType<typeof createMigratedDb>>["db"];
