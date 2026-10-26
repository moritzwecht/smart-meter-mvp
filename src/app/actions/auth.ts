"use server";

import { compare, hash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { apiTokens, authTokens, householdUsers, users } from "@/lib/db/schema";
import { emailSchema, passwordSchema } from "@/lib/sync/schemas";
import { action, UserError } from "@/lib/server/action";
import { consumeToken, createAuthToken, findValidToken, invalidateResetTokens } from "@/lib/server/auth-tokens";
import { hashToken } from "@/lib/server/crypto";
import { getDb } from "@/lib/server/db";
import { sendMail } from "@/lib/server/email";
import { appUrl } from "@/lib/server/env";
import { logError } from "@/lib/server/log";
import { clearAttempts, clientIp, takeAttempt } from "@/lib/server/rate-limit";
import { endSession, publicUser, requireUser, startSession, type AuthUser } from "@/lib/server/session";

const BCRYPT_ROUNDS = 11;
// Für gleich lange Antwortzeiten, wenn es den Nutzer nicht gibt (kein Nutzer-Enumerations-Timing).
const DUMMY_HASH = "$2b$11$7EZQk68M98lbTWhQqwcdTu.vvqOB8ieLbnfUh8rO0dyhVwKBBJbdG";

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
    return {
        id: row.id,
        email: row.email,
        name: row.name || row.email.split("@")[0],
        hasPassword: !!row.password,
        sessionVersion: row.sessionVersion,
    };
}

async function joinHousehold(userId: number, householdId: number) {
    await getDb()
        .insert(householdUsers)
        .values({ householdId, userId, role: "MEMBER" })
        .onConflictDoNothing({ target: [householdUsers.householdId, householdUsers.userId] });
}

// Login -----------------------------------------------------------------------

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, { error: "Bitte gib dein Passwort ein." }).max(200) });

const loginAction = action(loginSchema, async ({ email, password }) => {
    const keys = [`login:${email}`, `login-ip:${await clientIp()}`];
    const attempt = await takeAttempt(keys, 10, 15);
    if (attempt.limited) {
        throw new UserError("Zu viele Fehlversuche. Bitte warte 15 Minuten und versuche es dann erneut.");
    }
    const user = await getDb().query.users.findFirst({ where: eq(users.email, email) });
    // Immer einen Hash prüfen (gleiche Antwortzeit) und immer dieselbe Meldung –
    // verrät weder, ob es das Konto gibt, noch ob es schon ein Passwort hat.
    const valid = await compare(password, user?.password ?? DUMMY_HASH);
    if (!user?.password || !valid) {
        throw new UserError("E-Mail oder Passwort ist falsch. Noch kein Passwort (Konto aus der alten App-Version)? Dann nutze „Passwort vergessen“.");
    }
    await attempt.release();
    await clearAttempts(keys[0]);
    await startSession(user);
    return publicUser(toAuthUser(user));
});

export async function login(input: z.input<typeof loginSchema>) {
    return loginAction(input);
}

// Registrierung ---------------------------------------------------------------

const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().max(80).optional(),
    inviteToken: z.string().max(200).optional(),
});

const registerAction = action(registerSchema, async ({ email, password, name, inviteToken }) => {
    const attempt = await takeAttempt([`register-ip:${await clientIp()}`], 10, 60);
    if (attempt.limited) throw new UserError("Zu viele Registrierungen. Bitte versuche es später erneut.");

    const db = getDb();
    const invite = inviteToken ? await findValidToken(inviteToken, "INVITE") : undefined;
    if (inviteToken && !invite) throw new UserError("Die Einladung ist ungültig oder abgelaufen.");

    // Bestehende Konten werden hier nie verändert – auch nicht solche ohne Passwort
    // (aus Version 1). Ein Passwort dafür gibt es nur über „Passwort vergessen“, also
    // mit Nachweis des Postfachs. Ein Einladungslink ist dafür kein Nachweis: Den
    // sieht auch, wer eingeladen hat.
    const existing = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (existing) {
        throw new UserError("Es gibt bereits ein Konto mit dieser E-Mail. Melde dich an oder nutze „Passwort vergessen“.");
    }

    const inserted = await db
        .insert(users)
        .values({ email, password: await hash(password, BCRYPT_ROUNDS), name: name || email.split("@")[0] })
        .onConflictDoNothing({ target: users.email })
        .returning();
    if (!inserted.length) throw new UserError("Es gibt bereits ein Konto mit dieser E-Mail.");
    const user = inserted[0];

    if (invite?.householdId && (await consumeToken(invite.id))) {
        await joinHousehold(user.id, invite.householdId);
    }
    await startSession(user);
    return publicUser(toAuthUser(user));
});

export async function register(input: z.input<typeof registerSchema>) {
    return registerAction(input);
}

// Passwort vergessen ------------------------------------------------------------

const requestResetSchema = z.object({ email: emailSchema });

/** Erst nach der Antwort ausführen (gleiche Antwortzeit, egal ob es das Konto gibt). */
function afterResponse(task: () => Promise<void>): Promise<void> {
    const safe = () => task().catch((error) => logError("reset", error));
    try {
        after(safe);
        return Promise.resolve();
    } catch {
        return safe(); // außerhalb eines Requests (Tests)
    }
}

const requestResetAction = action(requestResetSchema, async ({ email }) => {
    const attempt = await takeAttempt([`reset:${email}`, `reset-ip:${await clientIp()}`], 5, 60);
    if (attempt.limited) throw new UserError("Zu viele Anfragen. Bitte versuche es in einer Stunde erneut.");
    await afterResponse(async () => {
        const user = await getDb().query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
        if (!user) return;
        const token = await createAuthToken({ purpose: "RESET", email });
        await sendMail({
            to: email,
            subject: "Passwort festlegen – My Home",
            paragraphs: [
                "Du hast einen Link zum Festlegen deines Passworts angefordert.",
                "Der Link ist eine Stunde gültig. Falls du das nicht warst, kannst du diese E-Mail ignorieren.",
            ],
            action: { label: "Neues Passwort festlegen", url: `${appUrl()}/reset/${token}` },
        });
    });
    // Immer dieselbe Antwort – verrät nicht, ob es ein Konto gibt.
    return null;
});

export async function requestPasswordReset(input: z.input<typeof requestResetSchema>) {
    return requestResetAction(input);
}

const resetSchema = z.object({ token: z.string().min(1).max(200), password: passwordSchema });

const resetAction = action(resetSchema, async ({ token, password }) => {
    const record = await findValidToken(token, "RESET");
    if (!record) throw new UserError("Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.");
    if (!(await consumeToken(record.id))) throw new UserError("Der Link wurde bereits verwendet.");
    const db = getDb();
    const [user] = await db
        .update(users)
        .set({ password: await hash(password, BCRYPT_ROUNDS), sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.email, record.email))
        .returning();
    if (!user) throw new UserError("Das Konto existiert nicht mehr.");
    // Konto zurückgeholt: alle anderen Zugänge beenden – Sessions (sessionVersion),
    // weitere Reset-Links und API-Tokens, die jemand anderes angelegt haben könnte.
    await invalidateResetTokens(record.email);
    await db.delete(apiTokens).where(eq(apiTokens.userId, user.id));
    await startSession(user);
    return publicUser(toAuthUser(user));
});

export async function resetPassword(input: z.input<typeof resetSchema>) {
    return resetAction(input);
}

// Einladung annehmen ------------------------------------------------------------

const acceptInviteSchema = z.object({ token: z.string().min(1).max(200) });

const acceptInviteAction = action(acceptInviteSchema, async ({ token }) => {
    const user = await requireUser();
    const db = getDb();
    const invite = await db.query.authTokens.findFirst({
        where: and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.purpose, "INVITE")),
    });
    if (!invite?.householdId) throw new UserError("Die Einladung ist ungültig oder abgelaufen.");
    const already = await db.query.householdUsers.findFirst({
        where: and(eq(householdUsers.householdId, invite.householdId), eq(householdUsers.userId, user.id)),
    });
    // Schon Mitglied (z. B. direkt bei der Registrierung beigetreten) → einfach weiter
    if (already) return { householdId: invite.householdId };
    if (invite.usedAt || invite.expiresAt < new Date()) throw new UserError("Die Einladung ist ungültig oder abgelaufen.");
    if (!(await consumeToken(invite.id))) throw new UserError("Die Einladung wurde bereits verwendet.");
    await joinHousehold(user.id, invite.householdId);
    return { householdId: invite.householdId };
});

export async function acceptInvite(input: z.input<typeof acceptInviteSchema>) {
    return acceptInviteAction(input);
}

// Abmelden ------------------------------------------------------------------------

export async function logout() {
    await endSession();
    return { ok: true as const, data: null };
}

const logoutEverywhereAction = action(z.object({}), async () => {
    const user = await requireUser();
    const [row] = await getDb()
        .update(users)
        .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, user.id))
        .returning();
    await startSession(row);
    return null;
});

/** Beendet alle anderen Sessions; dieses Gerät bleibt angemeldet. */
export async function logoutEverywhere() {
    return logoutEverywhereAction({});
}
