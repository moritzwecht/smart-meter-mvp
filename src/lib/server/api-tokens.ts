import "server-only";
import { UserError } from "./action";
import { and, eq, lt, or, isNull, sql } from "drizzle-orm";
import { apiTokens } from "@/lib/db/schema";
import { getDb } from "./db";
import { hashToken, randomToken } from "./crypto";

/*
 * Persönliche API-Tokens (z. B. für Home Assistant / ESPHome).
 * Format: "mh_" + 43 Zeichen Zufall. Gespeichert wird nur der SHA-256-Hash;
 * den Klartext sieht man genau einmal beim Erstellen.
 */

export const API_TOKEN_PREFIX = "mh_";
const MAX_TOKENS_PER_USER = 10;

export async function createApiToken(userId: number, name: string) {
    const db = getDb();
    const existing = await db.select({ id: apiTokens.id }).from(apiTokens).where(eq(apiTokens.userId, userId));
    if (existing.length >= MAX_TOKENS_PER_USER) {
        throw new UserError(`Maximal ${MAX_TOKENS_PER_USER} Tokens – bitte erst einen löschen.`);
    }
    const token = `${API_TOKEN_PREFIX}${randomToken()}`;
    const [row] = await db
        .insert(apiTokens)
        .values({ userId, name, tokenHash: hashToken(token), tokenPrefix: token.slice(0, 10) })
        .returning({ id: apiTokens.id, name: apiTokens.name, tokenPrefix: apiTokens.tokenPrefix, createdAt: apiTokens.createdAt });
    return { token, ...row };
}

export async function listApiTokens(userId: number) {
    return getDb()
        .select({ id: apiTokens.id, name: apiTokens.name, tokenPrefix: apiTokens.tokenPrefix, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(apiTokens.createdAt);
}

export async function deleteApiToken(userId: number, id: number) {
    await getDb()
        .delete(apiTokens)
        .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}

/** Prüft `Authorization: Bearer mh_…` und liefert die Nutzer-ID. */
export async function authenticateApiRequest(request: Request): Promise<{ userId: number; tokenId: number } | null> {
    const header = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(mh_[A-Za-z0-9_-]{20,100})$/.exec(header.trim());
    if (!match) return null;
    const db = getDb();
    const [row] = await db
        .select({ id: apiTokens.id, userId: apiTokens.userId })
        .from(apiTokens)
        .where(eq(apiTokens.tokenHash, hashToken(match[1])));
    if (!row) return null;
    // "Zuletzt verwendet" höchstens stündlich aktualisieren
    await db
        .update(apiTokens)
        .set({ lastUsedAt: sql`now()` })
        .where(and(eq(apiTokens.id, row.id), or(isNull(apiTokens.lastUsedAt), lt(apiTokens.lastUsedAt, sql`now() - interval '1 hour'`))));
    return { userId: row.userId, tokenId: row.id };
}
