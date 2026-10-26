import "server-only";
import { and, count, eq, gt, inArray, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { authAttempts } from "@/lib/db/schema";
import { getDb } from "./db";

/*
 * Einfaches, datenbankbasiertes Rate-Limit für die Anmeldung per Code
 * und für Einladungen. Reicht für eine private App völlig aus und
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
    return ipBucket((candidate ?? "unknown").trim().slice(0, 64) || "unknown");
}

/**
 * IPv6-Adressen auf ihr /64-Netz kürzen: Ein einzelner Anschluss bekommt meist ein
 * ganzes /64 – sonst hätte jeder Angreifer praktisch unbegrenzt viele "IPs".
 */
export function ipBucket(ip: string): string {
    if (!ip.includes(":")) return ip;
    const [head, tail = ""] = ip.toLowerCase().split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
    return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
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

/** Mehrere Limits zugleich – ist eines erreicht, zählt keines der anderen mit. */
export async function takeAttempts(checks: { key: string; limit: number; minutes: number }[]): Promise<Attempt> {
    const taken: Attempt[] = [];
    for (const check of checks) {
        const attempt = await takeAttempt([check.key], check.limit, check.minutes);
        if (attempt.limited) {
            for (const t of taken) await t.release();
            return { limited: true, release: async () => {} };
        }
        taken.push(attempt);
    }
    return {
        limited: false,
        async release() {
            for (const t of taken) await t.release();
        },
    };
}

export async function clearAttempts(key: string) {
    await getDb().delete(authAttempts).where(eq(authAttempts.key, key));
}

export async function purgeOldAttempts(olderThanHours = 48) {
    await getDb()
        .delete(authAttempts)
        .where(lt(authAttempts.createdAt, new Date(Date.now() - olderThanHours * 3_600_000)));
}
