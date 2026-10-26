import "server-only";
import { and, count, eq, gt, inArray, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { authAttempts } from "@/lib/db/schema";
import { getDb } from "./db";

/*
 * Einfaches, datenbankbasiertes Rate-Limit für Login, Registrierung,
 * Passwort-Reset und Einladungen. Reicht für eine private App völlig aus und
 * braucht keine zusätzliche Infrastruktur (Redis o. Ä.).
 *
 * Der Versuch wird *zuerst* gespeichert und dann gezählt – so können parallele
 * Anfragen das Limit nicht umgehen (kein Check-then-Insert-Race). Abgewiesene
 * Versuche werden direkt wieder entfernt.
 */

/**
 * Client-IP. Vercel und übliche Reverse-Proxys setzen `x-real-ip` selbst; der
 * linke Eintrag von `x-forwarded-for` ist nur ein Fallback, weil er bei
 * anhängenden Proxys vom Client stammen kann.
 */
export async function clientIp(): Promise<string> {
    const h = await headers();
    const candidate = h.get("x-real-ip") ?? h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for")?.split(",")[0];
    return (candidate ?? "unknown").trim().slice(0, 64) || "unknown";
}

export interface Attempt {
    limited: boolean;
    /** Nimmt den Versuch zurück (z. B. nach erfolgreichem Login). */
    release(): Promise<void>;
}

export async function takeAttempt(keys: string[], limit: number, windowMinutes: number): Promise<Attempt> {
    const db = getDb();
    const inserted = keys.length ? await db.insert(authAttempts).values(keys.map((key) => ({ key }))).returning({ id: authAttempts.id }) : [];
    const since = new Date(Date.now() - windowMinutes * 60_000);
    let limited = false;
    for (const key of keys) {
        const [{ n }] = await db
            .select({ n: count() })
            .from(authAttempts)
            .where(and(eq(authAttempts.key, key), gt(authAttempts.createdAt, since)));
        if (n > limit) {
            limited = true;
            break;
        }
    }
    const ids = inserted.map((r) => r.id);
    const release = async () => {
        if (ids.length) await db.delete(authAttempts).where(inArray(authAttempts.id, ids));
    };
    // Abgewiesene Versuche nicht mitzählen: sonst verlängert jeder weitere Versuch die
    // Sperre, und wer die Seite flutet, füllt die Tabelle. (Durchgelassene Versuche
    // bleiben stehen – deshalb bleibt das Limit auch bei parallelen Anfragen dicht.)
    if (limited) await release();
    return { limited, release: limited ? async () => {} : release };
}

export async function clearAttempts(key: string) {
    await getDb().delete(authAttempts).where(eq(authAttempts.key, key));
}

export async function purgeOldAttempts(olderThanHours = 48) {
    await getDb()
        .delete(authAttempts)
        .where(lt(authAttempts.createdAt, new Date(Date.now() - olderThanHours * 3_600_000)));
}
