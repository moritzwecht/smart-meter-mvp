import "server-only";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { authTokens, households, users } from "@/lib/db/schema";
import { getDb } from "./db";
import { hashToken, randomToken } from "./crypto";

export type TokenPurpose = "INVITE" | "RESET";

const LIFETIME_MINUTES: Record<TokenPurpose, number> = {
    INVITE: 7 * 24 * 60,
    RESET: 60,
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

/** Macht offene Reset-Links einer Adresse ungültig (nach Reset oder Passwortänderung). */
export async function invalidateResetTokens(email: string) {
    await getDb()
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(authTokens.email, email), eq(authTokens.purpose, "RESET"), isNull(authTokens.usedAt)));
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
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, invite.email), columns: { password: true } });
    return {
        id: invite.id,
        email: invite.email,
        householdId: household.id,
        householdName: household.name,
        inviterName: inviter ? inviter.name || inviter.email : null,
        /** Konto existiert bereits mit Passwort → anmelden; sonst registrieren / Passwort setzen. */
        accountExists: !!existingUser?.password,
    };
}

export async function purgeExpiredTokens() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000);
    await getDb()
        .delete(authTokens)
        .where(or(lt(authTokens.expiresAt, weekAgo), lt(authTokens.usedAt, weekAgo)));
}
