import "server-only";

/**
 * Fehler kompakt und ohne personenbezogene Daten loggen: Datenbankfehler von
 * Drizzle enthalten in der Meldung sonst die SQL-Parameter (E-Mails, Hashes …).
 */
export function describeError(error: unknown): string {
    if (!(error instanceof Error)) return String(error).slice(0, 200);
    const cause = (error as { cause?: unknown }).cause;
    const code = cause && typeof cause === "object" && "code" in cause ? String((cause as { code: unknown }).code) : null;
    const firstLine = error.message.split("\n")[0].replace(/params:.*$/i, "").slice(0, 300);
    const causeText = cause instanceof Error ? ` ← ${cause.message.split("\n")[0].slice(0, 200)}` : "";
    return `${error.name}${code ? ` [${code}]` : ""}: ${firstLine}${causeText}`;
}

export function logError(scope: string, error: unknown) {
    console.error(`[${scope}] ${describeError(error)}`);
}
