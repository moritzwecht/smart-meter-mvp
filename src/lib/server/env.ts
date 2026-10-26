import "server-only";

/*
 * Zentrale Stelle für Umgebungsvariablen. Fehlende Pflichtwerte führen in
 * Produktion zu einem klaren Fehler – nie zu einem stillen, unsicheren Default.
 */

const isProduction = process.env.NODE_ENV === "production";
const DEV_SECRET = "dev-only-secret-do-not-use-in-production-0123456789";

let warnedAboutSecret = false;

export function authSecret(): Uint8Array {
    const secret = process.env.AUTH_SECRET;
    if (secret && secret.length >= 32) return new TextEncoder().encode(secret);
    if (isProduction) {
        throw new Error("AUTH_SECRET fehlt oder ist kürzer als 32 Zeichen. Bitte in den Umgebungsvariablen setzen.");
    }
    if (!warnedAboutSecret) {
        console.warn("[auth] AUTH_SECRET nicht gesetzt – nutze Entwicklungs-Secret.");
        warnedAboutSecret = true;
    }
    return new TextEncoder().encode(DEV_SECRET);
}

export function databaseUrl(): string {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL (oder POSTGRES_URL) ist nicht gesetzt.");
    return url;
}

/**
 * Öffentliche Basis-URL für Links in E-Mails. Bewusst NICHT aus dem Host-Header
 * abgeleitet (sonst könnte ein manipulierter Header Links auf fremde Domains erzeugen).
 */
export function appUrl(): string {
    const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
    if (explicit) return explicit.replace(/\/+$/, "");
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (vercel) return `https://${vercel}`;
    return "http://localhost:3000";
}

export function emailConfig() {
    const apiKey = process.env.RESEND_API_KEY;
    return {
        apiKey: apiKey?.startsWith("re_") ? apiKey : undefined,
        from: process.env.EMAIL_FROM ?? "My Home <login@home.moritz-wecht.de>",
    };
}

export function vapidConfig() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
    if (!publicKey || !privateKey) return null;
    return { publicKey, privateKey, subject };
}

export function cronSecret(): string | undefined {
    return process.env.CRON_SECRET || undefined;
}

export { isProduction };
