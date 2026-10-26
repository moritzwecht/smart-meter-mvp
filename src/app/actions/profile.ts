"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions, users } from "@/lib/db/schema";
import { action, UserError } from "@/lib/server/action";
import { createApiToken, deleteApiToken, listApiTokens } from "@/lib/server/api-tokens";
import { getDb } from "@/lib/server/db";
import { isPushConfigured, sendPushToUser } from "@/lib/server/push";
import { publicUser, requireUser } from "@/lib/server/session";

const nameSchema = z.object({ name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(80) });

const updateNameAction = action(nameSchema, async ({ name }) => {
    const user = await requireUser();
    await getDb().update(users).set({ name }).where(eq(users.id, user.id));
    return publicUser({ ...user, name });
});

export async function updateName(input: z.input<typeof nameSchema>) {
    return updateNameAction(input);
}

// API-Tokens (Home Assistant & Co.) --------------------------------------------------

export interface ApiTokenInfo {
    id: number;
    name: string;
    tokenPrefix: string;
    createdAt: string;
    lastUsedAt: string | null;
}

const listTokensAction = action(z.object({}), async (): Promise<ApiTokenInfo[]> => {
    const user = await requireUser();
    const rows = await listApiTokens(user.id);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null }));
});

export async function getApiTokens() {
    return listTokensAction({});
}

const createTokenSchema = z.object({ name: z.string().trim().min(1, { error: "Bitte gib dem Token einen Namen." }).max(60) });

const createTokenAction = action(createTokenSchema, async ({ name }) => {
    const user = await requireUser();
    const created = await createApiToken(user.id, name);
    return { token: created.token, id: created.id };
});

/** Der Klartext-Token wird nur in dieser Antwort zurückgegeben. */
export async function createToken(input: z.input<typeof createTokenSchema>) {
    return createTokenAction(input);
}

const deleteTokenSchema = z.object({ id: z.number().int().positive() });

const deleteTokenAction = action(deleteTokenSchema, async ({ id }) => {
    const user = await requireUser();
    await deleteApiToken(user.id, id);
    return null;
});

export async function deleteToken(input: z.input<typeof deleteTokenSchema>) {
    return deleteTokenAction(input);
}

// Ablese-Erinnerung & Push ----------------------------------------------------------

const reminderSettingsAction = action(z.object({}), async () => {
    const user = await requireUser();
    const row = await getDb().query.users.findFirst({ where: eq(users.id, user.id), columns: { reminderDay: true } });
    const subscriptions = await getDb().select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    return {
        reminderDay: row?.reminderDay ?? null,
        pushAvailable: isPushConfigured(),
        endpoints: subscriptions.map((s) => s.endpoint),
    };
});

export async function getReminderSettings() {
    return reminderSettingsAction({});
}

const reminderDaySchema = z.object({ day: z.number().int().min(1).max(28).nullable() });

const setReminderDayAction = action(reminderDaySchema, async ({ day }) => {
    const user = await requireUser();
    await getDb().update(users).set({ reminderDay: day }).where(eq(users.id, user.id));
    return null;
});

export async function setReminderDay(input: z.input<typeof reminderDaySchema>) {
    return setReminderDayAction(input);
}

// Nur echte Push-Dienste der Browser – sonst könnte man den Server beliebige URLs aufrufen lassen (SSRF).
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

const subscriptionSchema = z.object({
    endpoint: z
        .url()
        .max(1000)
        .refine(
            (u) => {
                const url = new URL(u);
                return url.protocol === "https:" && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
            },
            { error: "Dieser Push-Dienst wird nicht unterstützt." },
        ),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

const savePushAction = action(subscriptionSchema, async ({ endpoint, keys }) => {
    const user = await requireUser();
    await getDb()
        .insert(pushSubscriptions)
        .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth } });
    return null;
});

export async function savePushSubscription(input: z.input<typeof subscriptionSchema>) {
    return savePushAction(input);
}

const removePushSchema = z.object({ endpoint: z.string().max(1000) });

const removePushAction = action(removePushSchema, async ({ endpoint }) => {
    const user = await requireUser();
    await getDb()
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
    return null;
});

export async function removePushSubscription(input: z.input<typeof removePushSchema>) {
    return removePushAction(input);
}

const testPushAction = action(z.object({}), async () => {
    const user = await requireUser();
    if (!isPushConfigured()) throw new UserError("Push ist auf dem Server nicht eingerichtet (VAPID-Schlüssel fehlen).");
    const result = await sendPushToUser(user.id, {
        title: "My Home",
        body: "Push-Benachrichtigungen funktionieren 🎉",
        tag: "test",
    });
    if (!result.sent) throw new UserError("Kein Gerät erreicht – ist die Benachrichtigung auf diesem Gerät aktiviert?");
    return result;
});

export async function sendTestPush() {
    return testPushAction({});
}
