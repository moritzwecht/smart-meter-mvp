import { cleanup, sendReadingReminders } from "@/lib/server/cron";
import { safeEqual } from "@/lib/server/crypto";
import { cronSecret } from "@/lib/server/env";
import { errorResponse, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Täglicher Job: Ablese-Erinnerungen per Push + Aufräumen.
 * Auf Vercel ruft `vercel.json` (crons) das automatisch auf und schickt dabei
 * `Authorization: Bearer $CRON_SECRET`. Alternativ z. B. aus n8n aufrufen.
 */
export async function GET(request: Request) {
    const secret = cronSecret();
    if (!secret) return errorResponse(503, "CRON_SECRET ist nicht gesetzt.");
    const header = request.headers.get("authorization") ?? "";
    if (!safeEqual(header, `Bearer ${secret}`)) return errorResponse(401, "Nicht autorisiert");

    const reminders = await sendReadingReminders();
    const purged = await cleanup();
    return json({ ok: true, reminders, purged });
}
