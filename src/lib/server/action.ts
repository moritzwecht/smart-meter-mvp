import "server-only";
import { ZodError, type ZodType } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ForbiddenError } from "./access";
import { UnauthorizedError } from "./session";

/** Fachlicher Fehler mit Meldung für den Nutzer. */
export class UserError extends Error {}

/**
 * Hüllt eine Server Action ein: Eingaben werden validiert, erwartbare Fehler als
 * `{ ok: false, error }` zurückgegeben, unerwartete geloggt und neutral gemeldet.
 */
export function action<I, O>(schema: ZodType<I>, handler: (input: I) => Promise<O>) {
    return async (raw: unknown): Promise<ActionResult<O>> => {
        try {
            const input = schema.parse(raw);
            return { ok: true, data: await handler(input) };
        } catch (error) {
            if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Ungültige Eingabe." };
            if (error instanceof UnauthorizedError) return { ok: false, error: "Bitte melde dich erneut an." };
            if (error instanceof ForbiddenError || error instanceof UserError) return { ok: false, error: error.message };
            console.error("[action] Unerwarteter Fehler:", error);
            return { ok: false, error: "Da ist etwas schiefgelaufen. Bitte versuche es erneut." };
        }
    };
}
