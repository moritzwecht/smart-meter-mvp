"use server";

import { compare, hash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { householdUsers, users } from "@/lib/db/schema";
import { emailSchema, passwordSchema } from "@/lib/sync/schemas";
import { action, UserError } from "@/lib/server/action";
import { consumeToken, createAuthToken, findValidToken } from "@/lib/server/auth-tokens";
import { getDb } from "@/lib/server/db";
import { sendMail } from "@/lib/server/email";
import { appUrl } from "@/lib/server/env";
import { clearAttempts, clientIp, isRateLimited, recordAttempt } from "@/lib/server/rate-limit";
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
    if (await isRateLimited(keys, 10, 15)) {
        throw new UserError("Zu viele Fehlversuche. Bitte warte 15 Minuten und versuche es dann erneut.");
    }
    const user = await getDb().query.users.findFirst({ where: eq(users.email, email) });
    if (user && !user.password) {
        throw new UserError("Für dieses Konto ist noch kein Passwort gesetzt. Nutze „Passwort vergessen“, um eins festzulegen.");
    }
    const valid = await compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) {
        await recordAttempt(keys);
        throw new UserError("E-Mail oder Passwort ist falsch.");
    }
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
    const ipKey = `register-ip:${await clientIp()}`;
    if (await isRateLimited([ipKey], 10, 60)) {
        throw new UserError("Zu viele Registrierungen. Bitte versuche es später erneut.");
    }
    await recordAttempt([ipKey]);

    const db = getDb();
    const invite = inviteToken ? await findValidToken(inviteToken, "INVITE") : undefined;
    if (inviteToken && !invite) throw new UserError("Die Einladung ist ungültig oder abgelaufen.");
    const inviteMatchesEmail = invite?.email === email;

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing?.password) {
        throw new UserError("Es gibt bereits ein Konto mit dieser E-Mail. Melde dich an oder nutze „Passwort vergessen“.");
    }
    if (existing && !inviteMatchesEmail) {
        // Konto ohne Passwort (z. B. aus einer alten Einladung): Wer es übernehmen will,
        // muss Zugriff auf das Postfach nachweisen – sonst wäre das eine Account-Übernahme.
        throw new UserError(
            "Für diese E-Mail gibt es schon ein Konto ohne Passwort. Nutze „Passwort vergessen“, um per E-Mail ein Passwort festzulegen.",
        );
    }

    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    let user: typeof users.$inferSelect;
    if (existing) {
        [user] = await db
            .update(users)
            .set({ password: passwordHash, name: name || existing.name || email.split("@")[0], sessionVersion: sql`${users.sessionVersion} + 1` })
            .where(eq(users.id, existing.id))
            .returning();
    } else {
        const inserted = await db
            .insert(users)
            .values({ email, password: passwordHash, name: name || email.split("@")[0] })
            .onConflictDoNothing({ target: users.email })
            .returning();
        if (!inserted.length) throw new UserError("Es gibt bereits ein Konto mit dieser E-Mail.");
        user = inserted[0];
    }

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

const requestResetAction = action(requestResetSchema, async ({ email }) => {
    const keys = [`reset:${email}`, `reset-ip:${await clientIp()}`];
    if (await isRateLimited(keys, 5, 60)) {
        throw new UserError("Zu viele Anfragen. Bitte versuche es in einer Stunde erneut.");
    }
    await recordAttempt(keys);
    const user = await getDb().query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (user) {
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
    }
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
    const [user] = await getDb()
        .update(users)
        .set({ password: await hash(password, BCRYPT_ROUNDS), sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.email, record.email))
        .returning();
    if (!user) throw new UserError("Das Konto existiert nicht mehr.");
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
    const invite = await findValidToken(token, "INVITE");
    if (!invite?.householdId) throw new UserError("Die Einladung ist ungültig oder abgelaufen.");
    const already = await getDb().query.householdUsers.findFirst({
        where: and(eq(householdUsers.householdId, invite.householdId), eq(householdUsers.userId, user.id)),
    });
    if (!already) {
        if (!(await consumeToken(invite.id))) throw new UserError("Die Einladung wurde bereits verwendet.");
        await joinHousehold(user.id, invite.householdId);
    }
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
