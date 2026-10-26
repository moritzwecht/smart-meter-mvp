import "server-only";
import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { databaseUrl } from "./env";

/*
 * Datenbankzugriff
 * ----------------
 * - Neon (Produktion auf Vercel): HTTP-Treiber, ideal für Serverless.
 * - Jede andere Postgres-URL (lokal, Docker, Hetzner …): klassischer `pg`-Pool.
 * Per `DATABASE_DRIVER=neon|pg` lässt sich die Auswahl erzwingen.
 *
 * Der Code nutzt bewusst keine interaktiven Transaktionen (die der Neon-HTTP-
 * Treiber nicht kann); jede Sync-Operation ist ein einzelnes, idempotentes Statement.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let instance: Db | undefined;

function isNeonUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname;
        return host.endsWith(".neon.tech") || host.endsWith(".vercel-storage.com");
    } catch {
        return false;
    }
}

function create(): Db {
    const url = databaseUrl();
    const driver = process.env.DATABASE_DRIVER ?? (isNeonUrl(url) ? "neon" : "pg");
    if (driver === "neon") {
        return drizzleNeon(neon(url), { schema }) as unknown as Db;
    }
    const pool = new Pool({
        connectionString: url,
        max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    });
    return drizzlePg(pool, { schema }) as unknown as Db;
}

export function getDb(): Db {
    instance ??= create();
    return instance;
}

/** Nur für Tests: eigene Datenbank (z. B. PGlite) injizieren. */
export function setDbForTesting(db: Db | undefined) {
    instance = db;
}
