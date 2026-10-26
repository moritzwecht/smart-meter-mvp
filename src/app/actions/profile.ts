"use server";

import { compare, hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "@/lib/db/schema";
import { passwordSchema } from "@/lib/sync/schemas";
import { action, UserError } from "@/lib/server/action";
import { getDb } from "@/lib/server/db";
import { publicUser, requireUser, startSession } from "@/lib/server/session";

const nameSchema = z.object({ name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(80) });

const updateNameAction = action(nameSchema, async ({ name }) => {
    const user = await requireUser();
    await getDb().update(users).set({ name }).where(eq(users.id, user.id));
    return publicUser({ ...user, name });
});

export async function updateName(input: z.input<typeof nameSchema>) {
    return updateNameAction(input);
}

const passwordChangeSchema = z.object({
    currentPassword: z.string().max(200).optional(),
    newPassword: passwordSchema,
});

const changePasswordAction = action(passwordChangeSchema, async ({ currentPassword, newPassword }) => {
    const user = await requireUser();
    const db = getDb();
    const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    if (!row) throw new UserError("Konto nicht gefunden.");
    if (row.password) {
        if (!currentPassword) throw new UserError("Bitte gib zur Bestätigung dein aktuelles Passwort ein.");
        if (!(await compare(currentPassword, row.password))) throw new UserError("Das aktuelle Passwort ist nicht korrekt.");
    }
    // Neues Passwort beendet alle anderen Sessions; dieses Gerät bleibt angemeldet.
    const [updated] = await db
        .update(users)
        .set({ password: await hash(newPassword, 11), sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, user.id))
        .returning();
    await startSession(updated);
    return null;
});

export async function changePassword(input: z.input<typeof passwordChangeSchema>) {
    return changePasswordAction(input);
}
