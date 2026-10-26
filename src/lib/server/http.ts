import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

const noStore = { "Cache-Control": "no-store" };

export function json<T>(data: T, init: ResponseInit = {}) {
    return NextResponse.json(data, { ...init, headers: { ...noStore, ...init.headers } });
}

export function errorResponse(status: number, error: string) {
    return json({ error }, { status });
}

/**
 * CSRF-Schutz für cookie-basierte POST-Endpunkte: Browser senden bei
 * Cross-Site-Requests einen fremden Origin mit. (Server Actions prüfen das
 * bereits selbst; Route Handler nicht.)
 */
export function isSameOrigin(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return true; // nicht-Browser-Clients
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<{ data: T } | { error: Response }> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return { error: errorResponse(400, "Ungültiges JSON") };
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return { error: errorResponse(400, parsed.error.issues[0]?.message ?? "Ungültige Daten") };
    return { data: parsed.data };
}

/**
 * Der Client schickt mit, für welchen Nutzer seine lokalen Daten sind. Passt das
 * nicht zum Cookie (anderes Konto im selben Browser angemeldet), wird nichts
 * angewendet – sonst landeten Änderungen von Konto A bei Konto B.
 */
export function isUserMismatch(request: Request, userId: number): boolean {
    const claimed = request.headers.get("x-myhome-user");
    return claimed !== null && claimed !== String(userId);
}

export const userMismatchResponse = () => errorResponse(409, "Auf diesem Gerät ist ein anderes Konto angemeldet.");
