"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authTokens, householdUsers, users } from "@/lib/db/schema";
import { emailSchema } from "@/lib/sync/schemas";
import { action, UserError } from "@/lib/server/action";
import { consumeLoginCode, consumeToken, createLoginCode, findValidToken } from "@/lib/server/auth-tokens";
import { hashToken } from "@/lib/server/crypto";
import { getDb } from "@/lib/server/db";
import { isEmailConfigured, sendMail } from "@/lib/server/email";
import { isProduction } from "@/lib/server/env";
import { clientIp, takeAttempts } from "@/lib/server/rate-limit";
import { endSession, publicUser, requireUser, startSession, type AuthUser } from "@/lib/server/session";

/*
 * Anmeldung ohne Passwort
 * =======================
 * 1. E-Mail eingeben → 6-stelliger Code per Mail (10 Minuten gültig).
 * 2. Code eingeben → angemeldet. Gibt es noch kein Konto, wird es dabei angelegt.
 *
 * Da jede Adresse einen Code bekommt, verrät die Antwort nie, ob es ein Konto gibt.
 * Code statt Link, weil ein Link auf dem Handy oft im falschen Browser landet –
 * nicht in der Home-Bildschirm-App oder der iOS/Android-App.
 */

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
    return {
        id: row.id,
        email: row.email,
        name: row.name || row.email.split("@")[0],
        sessionVersion: row.sessionVersion,
    };
}

async function joinHousehold(userId: number, householdId: number) {
    await getDb()
        .insert(householdUsers)
        .values({ householdId, userId, role: "MEMBER" })
        .onConflictDoNothing({ target: [householdUsers.householdId, householdUsers.userId] });
}

// Code anfordern -----------------------------------------------------------------

const requestCodeSchema = z.object({ email: emailSchema });

const requestCodeAction = action(requestCodeSchema, async ({ email }) => {
    // Codes sollen weder als Spam-Schleuder noch zum Leerräumen des Mail-Kontingents taugen:
    // pro Adresse+Netz, pro Adresse, pro Netz (IPv6: /64) und insgesamt begrenzt.
    const ip = await clientIp();
    const attempt = await takeAttempts([
        { key: `code-request:${email}:${ip}`, limit: 5, minutes: 15 },
        { key: `code-request:${email}`, limit: 10, minutes: 24 * 60 },
        { key: `code-request-ip:${ip}`, limit: 20, minutes: 60 },
        { key: "code-request-all", limit: 60, minutes: 60 },
        { key: "code-request-all-day", limit: 300, minutes: 24 * 60 },
    ]);
    if (attempt.limited) throw new UserError("Zu viele Codes angefordert. Bitte warte ein paar Minuten und versuche es dann erneut.");

    const code = await createLoginCode(email);
    const sent = await sendMail({
        to: email,
        subject: `${code} ist dein Anmeldecode für My Home`,
        paragraphs: [
            `Dein Anmeldecode: ${code.slice(0, 3)} ${code.slice(3)}`,
            "Der Code ist 10 Minuten gültig. Falls du dich nicht anmelden wolltest, kannst du diese E-Mail ignorieren.",
        ],
    });
    // Ohne E-Mail-Versand (lokale Entwicklung) steht der Code in der Server-Konsole
    if (!sent && (isProduction || isEmailConfigured())) {
        throw new UserError("Die E-Mail konnte gerade nicht verschickt werden. Bitte versuche es gleich noch einmal.");
    }
    return null;
});

/** Schickt einen Anmeldecode an die Adresse – immer, auch wenn es noch kein Konto gibt. */
export async function requestLoginCode(input: z.input<typeof requestCodeSchema>) {
    return requestCodeAction(input);
}

// Code eingeben ------------------------------------------------------------------

const verifyCodeSchema = z.object({
    email: emailSchema,
    code: z
        .string()
        .transform((v) => v.replace(/\D/g, ""))
        .pipe(z.string().length(6, { error: "Der Code hat 6 Ziffern." })),
    inviteToken: z.string().max(200).optional(),
});

const verifyCodeAction = action(verifyCodeSchema, async ({ email, code, inviteToken }) => {
    // Raten verhindert vor allem das Limit pro Code (3 Versuche, siehe consumeLoginCode) –
    // zusammen mit max. 10 Codes pro Adresse und Tag. Die Limits hier bremsen nur Fluten
    // aus einem Netz; bewusst KEIN Limit nur pro Adresse: Sonst könnte jeder Fremde ein
    // Konto mit ein paar falschen Eingaben für alle sperren.
    const ip = await clientIp();
    const attempt = await takeAttempts([
        { key: `code-verify:${email}:${ip}`, limit: 30, minutes: 60 },
        { key: `code-verify-ip:${ip}`, limit: 100, minutes: 60 },
    ]);
    if (attempt.limited) throw new UserError("Zu viele Versuche. Bitte warte ein paar Minuten.");

    const result = await consumeLoginCode(email, code);
    if (result === "wrong") throw new UserError("Der Code stimmt nicht oder ist abgelaufen.");
    if (result === "exhausted") throw new UserError("Zu viele falsche Versuche – bitte fordere einen neuen Code an.");
    await attempt.release();

    const db = getDb();
    let user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
        // Erstes Anmelden mit dieser Adresse → Konto anlegen (der Code beweist das Postfach)
        await db
            .insert(users)
            .values({ email, name: email.split("@")[0] })
            .onConflictDoNothing({ target: users.email });
        user = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!user) throw new UserError("Das Konto konnte nicht angelegt werden. Bitte versuche es erneut.");
    }

    if (inviteToken) {
        const invite = await findValidToken(inviteToken, "INVITE");
        if (invite?.householdId && (await consumeToken(invite.id))) await joinHousehold(user.id, invite.householdId);
    }
    await startSession(user);
    return publicUser(toAuthUser(user));
});

/** Meldet mit dem Code aus der E-Mail an (und legt beim ersten Mal das Konto an). */
export async function verifyLoginCode(input: z.input<typeof verifyCodeSchema>) {
    return verifyCodeAction(input);
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
