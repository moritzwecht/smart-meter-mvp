import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { authTokens, households, users } from "@/lib/db/schema";
import { getDb } from "./db";
import { hashToken, randomToken, safeEqual } from "./crypto";
import { authSecret } from "./env";
import { takeAttempt } from "./rate-limit";

export type TokenPurpose = "INVITE";

const LIFETIME_MINUTES: Record<TokenPurpose, number> = {
    INVITE: 7 * 24 * 60,
};

export async function createAuthToken(options: {
    purpose: TokenPurpose;
    email: string;
    householdId?: number;
    createdBy?: number;
}): Promise<string> {
    const token = randomToken();
    await getDb()
        .insert(authTokens)
        .values({
            purpose: options.purpose,
            tokenHash: hashToken(token),
            email: options.email,
            householdId: options.householdId,
            createdBy: options.createdBy,
            expiresAt: new Date(Date.now() + LIFETIME_MINUTES[options.purpose] * 60_000),
        });
    return token;
}

export async function findValidToken(token: string, purpose: TokenPurpose) {
    if (!token || token.length > 200) return undefined;
    return getDb().query.authTokens.findFirst({
        where: and(
            eq(authTokens.tokenHash, hashToken(token)),
            eq(authTokens.purpose, purpose),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, new Date()),
        ),
    });
}

/** Markiert einen Token atomar als benutzt. `false`, wenn ihn jemand schneller eingelöst hat. */
export async function consumeToken(id: number): Promise<boolean> {
    const rows = await getDb()
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(authTokens.id, id), isNull(authTokens.usedAt)))
        .returning({ id: authTokens.id });
    return rows.length > 0;
}

// Anmeldecodes ------------------------------------------------------------------------
//
// Sechsstelliger Code per E-Mail, 10 Minuten gültig, nur einmal verwendbar. Pro Adresse
// gilt immer nur der zuletzt angeforderte Code; nach 5 falschen Eingaben ist er verbraucht.
// Gespeichert wird nur ein HMAC (mit AUTH_SECRET und Salz) – sechs Ziffern ließen sich
// aus einem einfachen Hash sonst in Sekunden zurückrechnen.

const LOGIN_CODE_MINUTES = 10;
const LOGIN_CODE_MAX_TRIES = 5;

function codeHmac(salt: string, email: string, code: string): string {
    return createHmac("sha256", authSecret()).update(`${salt}:${email}:${code}`).digest("hex");
}

export async function createLoginCode(email: string): Promise<string> {
    const db = getDb();
    await db
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(authTokens.email, email), eq(authTokens.purpose, "LOGIN"), isNull(authTokens.usedAt)));
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const salt = randomToken(12);
    await db.insert(authTokens).values({
        purpose: "LOGIN",
        tokenHash: `${salt}.${codeHmac(salt, email, code)}`,
        email,
        expiresAt: new Date(Date.now() + LOGIN_CODE_MINUTES * 60_000),
    });
    return code;
}

export type LoginCodeResult = "ok" | "wrong" | "expired" | "exhausted";

/** Prüft und verbraucht den aktuellen Code einer Adresse. */
export async function consumeLoginCode(email: string, code: string): Promise<LoginCodeResult> {
    const db = getDb();
    const [row] = await db
        .select()
        .from(authTokens)
        .where(and(eq(authTokens.email, email), eq(authTokens.purpose, "LOGIN"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
        .orderBy(desc(authTokens.id))
        .limit(1);
    if (!row) return "expired";
    const [salt, expected] = row.tokenHash.split(".");
    if (!/^\d{6}$/.test(code) || !safeEqual(codeHmac(salt, email, code), expected ?? "")) {
        const tries = await takeAttempt([`login-code:${row.id}`], LOGIN_CODE_MAX_TRIES - 1, LOGIN_CODE_MINUTES);
        if (tries.limited) {
            await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
            return "exhausted";
        }
        return "wrong";
    }
    return (await consumeToken(row.id)) ? "ok" : "expired";
}

export async function getInviteInfo(token: string) {
    const invite = await findValidToken(token, "INVITE");
    if (!invite?.householdId) return null;
    const db = getDb();
    const [household] = await db
        .select({ id: households.id, name: households.name })
        .from(households)
        .where(eq(households.id, invite.householdId));
    if (!household) return null;
    const inviter = invite.createdBy
        ? await db.query.users.findFirst({ where: eq(users.id, invite.createdBy), columns: { name: true, email: true } })
        : undefined;
    return {
        id: invite.id,
        email: invite.email,
        householdId: household.id,
        householdName: household.name,
        inviterName: inviter ? inviter.name || inviter.email : null,
    };
}

export async function purgeExpiredTokens() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000);
    await getDb()
        .delete(authTokens)
        .where(or(lt(authTokens.expiresAt, weekAgo), lt(authTokens.usedAt, weekAgo)));
}
