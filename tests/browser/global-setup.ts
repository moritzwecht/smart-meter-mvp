import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { startMailServer } from "./mail-server";

/** Migrationen anwenden, alle Tabellen leeren (jeder Lauf startet bei null) und das E-Mail-Postfach starten. */
export default async function globalSetup() {
    const url = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/myhome_e2e";
    if (/neon\.tech|vercel-storage|amazonaws/.test(url)) throw new Error("E2E_DATABASE_URL sieht nach einer echten Datenbank aus – Abbruch.");
    const pool = new Pool({ connectionString: url });
    try {
        await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
        await pool.query(
            "truncate users, households, household_users, meters, readings, todo_lists, todo_items, notes, auth_tokens, auth_attempts, api_tokens, push_subscriptions restart identity cascade",
        );
    } finally {
        await pool.end();
    }
    const mailServer = await startMailServer();
    return () => new Promise<void>((resolve) => mailServer.close(() => resolve()));
}
