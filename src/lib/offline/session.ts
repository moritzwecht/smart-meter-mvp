import type { SessionUser } from "@/lib/sync/types";
import { clearLocalData, getMeta, setMeta } from "./db";
import { startSync, stopSync } from "./sync-engine";

/*
 * Session auf dem Client – offline-first:
 * Ist ein Nutzer zwischengespeichert, startet die App sofort mit seinen lokalen
 * Daten (auch ohne Netz). Der Server bestätigt die Session im Hintergrund. Läuft
 * sie ab, bleiben die lokalen Daten und die Outbox erhalten, bis sich derselbe
 * Nutzer wieder anmeldet.
 */

export type SessionState =
    | { status: "loading" }
    | { status: "anonymous"; reason?: "expired" }
    | { status: "authenticated"; user: SessionUser };

let state: SessionState = { status: "loading" };
const listeners = new Set<() => void>();
let bootstrapped = false;

function setState(next: SessionState) {
    state = next;
    listeners.forEach((l) => l());
}

export const sessionStore = {
    get: () => state,
    getServer: (): SessionState => ({ status: "loading" }),
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

export async function bootstrapSession() {
    if (bootstrapped) return;
    bootstrapped = true;
    let cached: SessionUser | undefined;
    try {
        cached = await getMeta<SessionUser>("user");
    } catch (error) {
        console.error("[session] Lokale Datenbank nicht verfügbar", error);
    }
    if (cached) setState({ status: "authenticated", user: cached });

    try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const { user } = (await res.json()) as { user: SessionUser | null };
        if (user) {
            await signedIn(user);
        } else {
            stopSync();
            setState({ status: "anonymous", reason: cached ? "expired" : undefined });
        }
    } catch {
        // Offline: mit dem zwischengespeicherten Nutzer weiterarbeiten
        if (!cached) setState({ status: "anonymous" });
    }
}

/** Nach Login/Registrierung: bei Nutzerwechsel lokale Daten des alten Nutzers verwerfen. */
export async function signedIn(user: SessionUser) {
    const cached = await getMeta<SessionUser>("user");
    if (cached && cached.id !== user.id) {
        stopSync();
        await clearLocalData();
    }
    await setMeta("user", user);
    setState({ status: "authenticated", user });
}

export function sessionExpired() {
    stopSync();
    setState({ status: "anonymous", reason: "expired" });
}

/** Startet den Sync für den angemeldeten Nutzer (vom Dashboard aufgerufen). */
export function startUserSync(userId: number) {
    void startSync({ userId, onUnauthenticated: () => void revalidateSession() });
}

/**
 * Der Server hat die Session abgelehnt (401) oder gehört zu einem anderen Konto
 * (409): beim Server nachfragen, wer angemeldet ist, und entsprechend umschalten.
 */
export async function revalidateSession() {
    stopSync();
    let user: SessionUser | null = null;
    try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        if (res.ok) user = ((await res.json()) as { user: SessionUser | null }).user;
    } catch {
        // offline o. Ä. → wie abgelaufen behandeln
    }
    if (!user) return sessionExpired();
    const before = state.status === "authenticated" ? state.user.id : undefined;
    await signedIn(user);
    // Gleicher Nutzer → das Dashboard bleibt stehen, also Sync selbst neu starten
    if (before === user.id) startUserSync(user.id);
}

export async function signedOut() {
    stopSync();
    await clearLocalData();
    await clearRuntimeCaches();
    setState({ status: "anonymous" });
}

/** Laufzeit-Caches des Service Workers leeren (Precache der App-Shell bleibt). */
async function clearRuntimeCaches() {
    try {
        if (typeof caches === "undefined") return;
        const names = await caches.keys();
        await Promise.all(names.filter((n) => !n.includes("precache")).map((n) => caches.delete(n)));
    } catch {
        // nicht kritisch
    }
}

export async function updateCachedUser(patch: Partial<SessionUser>) {
    if (state.status !== "authenticated") return;
    const user = { ...state.user, ...patch };
    await setMeta("user", user);
    setState({ status: "authenticated", user });
}
