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
import { clearAttempts, clientIp, takeAttempt } from "@/lib/server/rate-limit";
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
    // Begrenzt pro Adresse und pro IP – Codes sollen nicht als Spam-Schleuder taugen
    const perEmail = await takeAttempt([`code-request:${email}`], 5, 15);
    const perIp = perEmail.limited ? perEmail : await takeAttempt([`code-request-ip:${await clientIp()}`], 20, 60);
    if (perEmail.limited || perIp.limited) {
        await perEmail.release();
        throw new UserError("Zu viele Codes angefordert. Bitte warte ein paar Minuten.");
    }

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
    // Raten unmöglich machen: pro Code 5 Versuche (siehe consumeLoginCode), dazu
    // insgesamt 20 Fehlversuche pro Adresse und Tag sowie 50 pro IP und Stunde.
    const perEmail = await takeAttempt([`code-verify:${email}`], 20, 24 * 60);
    const perIp = perEmail.limited ? perEmail : await takeAttempt([`code-verify-ip:${await clientIp()}`], 50, 60);
    if (perEmail.limited || perIp.limited) {
        await perEmail.release();
        throw new UserError("Zu viele falsche Codes. Bitte versuche es später erneut.");
    }

    const result = await consumeLoginCode(email, code);
    if (result === "wrong") throw new UserError("Der Code stimmt nicht. Bitte prüfe ihn noch einmal.");
    if (result === "exhausted") throw new UserError("Zu viele falsche Versuche – bitte fordere einen neuen Code an.");
    if (result === "expired") throw new UserError("Der Code ist abgelaufen oder wurde schon verwendet. Bitte fordere einen neuen an.");

    await perEmail.release();
    await perIp.release();
    await clearAttempts(`code-verify:${email}`);

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
