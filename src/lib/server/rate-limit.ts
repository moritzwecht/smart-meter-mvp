import "server-only";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { authAttempts } from "@/lib/db/schema";
import { getDb } from "./db";

/*
 * Einfaches, datenbankbasiertes Rate-Limit für Login, Registrierung und
 * Passwort-Reset. Reicht für eine private App völlig aus und braucht keine
 * zusätzliche Infrastruktur (Redis o. Ä.).
 */

export async function clientIp(): Promise<string> {
    const h = await headers();
    return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export async function isRateLimited(keys: string[], limit: number, windowMinutes: number): Promise<boolean> {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    const db = getDb();
    for (const key of keys) {
        const [{ n }] = await db
            .select({ n: count() })
            .from(authAttempts)
            .where(and(eq(authAttempts.key, key), gt(authAttempts.createdAt, since)));
        if (n >= limit) return true;
    }
    return false;
}

export async function recordAttempt(keys: string[]) {
    if (keys.length === 0) return;
    await getDb()
        .insert(authAttempts)
        .values(keys.map((key) => ({ key })));
}

export async function clearAttempts(key: string) {
    await getDb().delete(authAttempts).where(eq(authAttempts.key, key));
}

export async function purgeOldAttempts(olderThanHours = 48) {
    await getDb()
        .delete(authAttempts)
        .where(lt(authAttempts.createdAt, new Date(Date.now() - olderThanHours * 3_600_000)));
}
