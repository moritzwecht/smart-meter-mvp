"use server";

import { and, count, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { authTokens, households, householdUsers, users } from "@/lib/db/schema";
import { emailSchema } from "@/lib/sync/schemas";
import type { Household, Role } from "@/lib/sync/types";
import { requireMembership, requireOwner } from "@/lib/server/access";
import { action, UserError } from "@/lib/server/action";
import { createAuthToken } from "@/lib/server/auth-tokens";
import { getDb } from "@/lib/server/db";
import { sendMail } from "@/lib/server/email";
import { appUrl } from "@/lib/server/env";
import { clientIp, takeAttempt } from "@/lib/server/rate-limit";
import { requireUser } from "@/lib/server/session";

const nameSchema = z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(80, { error: "Der Name ist zu lang." });
const idSchema = z.number().int().positive();

// Anlegen / Umbenennen / Löschen -------------------------------------------------

const createSchema = z.object({ name: nameSchema });

const createAction = action(createSchema, async ({ name }): Promise<Household> => {
    const user = await requireUser();
    // Haushalt + Inhaber-Mitgliedschaft in einem Statement (atomar, ohne Transaktion)
    const result = (await getDb().execute(sql`
        WITH h AS (
            INSERT INTO ${households} (name, created_by) VALUES (${name}, ${user.id}) RETURNING id
        )
        INSERT INTO ${householdUsers} (household_id, user_id, role)
        SELECT id, ${user.id}, 'OWNER' FROM h
        RETURNING household_id AS id
    `)) as unknown as { rows: { id: number }[] };
    return { id: Number(result.rows[0].id), name, role: "OWNER" };
});

export async function createHousehold(input: z.input<typeof createSchema>) {
    return createAction(input);
}

const renameSchema = z.object({ householdId: idSchema, name: nameSchema });

const renameAction = action(renameSchema, async ({ householdId, name }) => {
    const user = await requireUser();
    await requireOwner(user.id, householdId);
    await getDb().update(households).set({ name }).where(eq(households.id, householdId));
    return null;
});

export async function renameHousehold(input: z.input<typeof renameSchema>) {
    return renameAction(input);
}

const deleteSchema = z.object({ householdId: idSchema });

const deleteAction = action(deleteSchema, async ({ householdId }) => {
    const user = await requireUser();
    await requireOwner(user.id, householdId);
    // Kaskadiert auf Zähler, Ablesungen, Listen, Notizen, Mitgliedschaften und Einladungen.
    await getDb().delete(households).where(eq(households.id, householdId));
    return null;
});

export async function deleteHousehold(input: z.input<typeof deleteSchema>) {
    return deleteAction(input);
}

// Mitglieder & Einladungen ----------------------------------------------------------

export interface HouseholdMember {
    userId: number;
    email: string;
    name: string;
    role: Role;
    isYou: boolean;
}

export interface PendingInvite {
    id: number;
    email: string;
    expiresAt: string;
}

const detailsSchema = z.object({ householdId: idSchema });

const detailsAction = action(detailsSchema, async ({ householdId }) => {
    const user = await requireUser();
    const membership = await requireMembership(user.id, householdId);
    const db = getDb();
    const memberRows = await db
        .select({ userId: users.id, email: users.email, name: users.name, role: householdUsers.role })
        .from(householdUsers)
        .innerJoin(users, eq(users.id, householdUsers.userId))
        .where(eq(householdUsers.householdId, householdId))
        .orderBy(householdUsers.createdAt);
    const members: HouseholdMember[] = memberRows.map((m) => ({
        userId: m.userId,
        email: m.email,
        name: m.name || m.email.split("@")[0],
        role: m.role as Role,
        isYou: m.userId === user.id,
    }));
    let invites: PendingInvite[] = [];
    if (membership.role === "OWNER") {
        const rows = await db
            .select({ id: authTokens.id, email: authTokens.email, expiresAt: authTokens.expiresAt })
            .from(authTokens)
            .where(
                and(
                    eq(authTokens.householdId, householdId),
                    eq(authTokens.purpose, "INVITE"),
                    isNull(authTokens.usedAt),
                    gt(authTokens.expiresAt, new Date()),
                ),
            )
            .orderBy(authTokens.createdAt);
        invites = rows.map((r) => ({ id: r.id, email: r.email, expiresAt: r.expiresAt.toISOString() }));
    }
    return { role: membership.role as Role, members, invites };
});

export async function getHouseholdDetails(input: z.input<typeof detailsSchema>) {
    return detailsAction(input);
}

const inviteSchema = z.object({ householdId: idSchema, email: emailSchema });

const inviteAction = action(inviteSchema, async ({ householdId, email }) => {
    const user = await requireUser();
    await requireOwner(user.id, householdId);
    const db = getDb();

    // Begrenzt pro Nutzer und pro IP – Einladungs-E-Mails sollen nicht als Spam-Schleuder taugen
    const attempt = await takeAttempt([`invite:${user.id}`, `invite-ip:${await clientIp()}`], 20, 24 * 60);
    if (attempt.limited) throw new UserError("Zu viele Einladungen heute. Bitte morgen erneut versuchen.");

    const [alreadyMember] = await db
        .select({ n: count() })
        .from(householdUsers)
        .innerJoin(users, eq(users.id, householdUsers.userId))
        .where(and(eq(householdUsers.householdId, householdId), eq(users.email, email)));
    if (alreadyMember.n > 0) {
        await attempt.release();
        throw new UserError("Diese Person ist bereits Mitglied.");
    }

    // Ältere offene Einladungen an dieselbe Adresse ersetzen
    await db
        .delete(authTokens)
        .where(and(eq(authTokens.householdId, householdId), eq(authTokens.email, email), eq(authTokens.purpose, "INVITE"), isNull(authTokens.usedAt)));

    const token = await createAuthToken({ purpose: "INVITE", email, householdId, createdBy: user.id });
    const [household] = await db.select({ name: households.name }).from(households).where(eq(households.id, householdId));
    const link = `${appUrl()}/invite/${token}`;
    const emailSent = await sendMail({
        to: email,
        subject: `Einladung zum Haushalt „${household.name}“`,
        paragraphs: [
            `${user.name} hat dich in den Haushalt „${household.name}“ in My Home eingeladen.`,
            "Über den Link kannst du die Einladung annehmen. Er ist 7 Tage gültig.",
        ],
        action: { label: "Einladung annehmen", url: link },
    });
    return { link, emailSent };
});

export async function inviteMember(input: z.input<typeof inviteSchema>) {
    return inviteAction(input);
}

const revokeSchema = z.object({ householdId: idSchema, inviteId: idSchema });

const revokeAction = action(revokeSchema, async ({ householdId, inviteId }) => {
    const user = await requireUser();
    await requireOwner(user.id, householdId);
    await getDb()
        .delete(authTokens)
        .where(and(eq(authTokens.id, inviteId), eq(authTokens.householdId, householdId), eq(authTokens.purpose, "INVITE")));
    return null;
});

export async function revokeInvite(input: z.input<typeof revokeSchema>) {
    return revokeAction(input);
}

const removeSchema = z.object({ householdId: idSchema, userId: idSchema });

const removeAction = action(removeSchema, async ({ householdId, userId }) => {
    const user = await requireUser();
    await requireOwner(user.id, householdId);
    if (userId === user.id) throw new UserError("Du kannst dich nicht selbst entfernen – nutze „Haushalt verlassen“.");
    const removed = await getDb()
        .delete(householdUsers)
        .where(and(eq(householdUsers.householdId, householdId), eq(householdUsers.userId, userId), eq(householdUsers.role, "MEMBER")))
        .returning({ id: householdUsers.id });
    if (!removed.length) throw new UserError("Inhaber können nicht entfernt werden.");
    return null;
});

export async function removeMember(input: z.input<typeof removeSchema>) {
    return removeAction(input);
}

const leaveSchema = z.object({ householdId: idSchema });

const leaveAction = action(leaveSchema, async ({ householdId }) => {
    const user = await requireUser();
    const membership = await requireMembership(user.id, householdId);
    const db = getDb();
    if (membership.role === "OWNER") {
        const [others] = await db
            .select({ n: count() })
            .from(householdUsers)
            .where(and(eq(householdUsers.householdId, householdId), eq(householdUsers.role, "OWNER"), ne(householdUsers.userId, user.id)));
        if (others.n === 0) throw new UserError("Als einziger Inhaber kannst du den Haushalt nicht verlassen – du kannst ihn aber löschen.");
    }
    await db.delete(householdUsers).where(eq(householdUsers.id, membership.id));
    return null;
});

export async function leaveHousehold(input: z.input<typeof leaveSchema>) {
    return leaveAction(input);
}

const promoteSchema = z.object({ householdId: idSchema, userId: idSchema });

const promoteAction = action(promoteSchema, async ({ householdId, userId }) => {
    const user = await requireUser();
    await requireOwner(user.id, householdId);
    await getDb()
        .update(householdUsers)
        .set({ role: "OWNER" })
        .where(and(eq(householdUsers.householdId, householdId), eq(householdUsers.userId, userId)));
    return null;
});

/** Macht ein Mitglied zusätzlich zum Inhaber (z. B. für die Partnerin / den Partner). */
export async function promoteMember(input: z.input<typeof promoteSchema>) {
    return promoteAction(input);
}
