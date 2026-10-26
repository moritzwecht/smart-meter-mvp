import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscriptions } from "@/lib/db/schema";
import { getDb } from "./db";
import { vapidConfig } from "./env";

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}

let configured = false;

export function isPushConfigured(): boolean {
    const config = vapidConfig();
    if (!config) return false;
    if (!configured) {
        webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
        configured = true;
    }
    return true;
}

/** Schickt eine Push-Nachricht an alle Geräte eines Nutzers; abgelaufene Abos werden entfernt. */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; removed: number }> {
    if (!isPushConfigured()) return { sent: 0, removed: 0 };
    const db = getDb();
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    let sent = 0;
    const expired: number[] = [];
    await Promise.all(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    JSON.stringify(payload),
                    { TTL: 24 * 60 * 60, urgency: "normal" },
                );
                sent++;
            } catch (error) {
                const status = (error as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) expired.push(sub.id);
                else console.warn("[push] Versand fehlgeschlagen", status, (error as Error).message);
            }
        }),
    );
    if (expired.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expired));
    return { sent, removed: expired.length };
}
