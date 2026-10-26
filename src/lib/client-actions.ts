"use client";

import { OUTDATED_CLIENT_ERROR, type ActionResult } from "@/lib/action-result";

/**
 * Ruft eine Server Action auf und macht aus Netzwerk-/Deployment-Fehlern ein
 * normales `{ ok: false }`-Ergebnis mit verständlicher Meldung.
 */
export async function runAction<T>(call: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
    try {
        return await call();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Failed to find Server Action|was not found on the server/i.test(message)) {
            return { ok: false, error: OUTDATED_CLIENT_ERROR };
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            return { ok: false, error: "Keine Internetverbindung – diese Aktion geht nur online." };
        }
        console.error("[action]", error);
        return { ok: false, error: "Der Server ist gerade nicht erreichbar. Bitte versuche es erneut." };
    }
}
