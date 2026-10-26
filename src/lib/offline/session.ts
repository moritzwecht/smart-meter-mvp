import type { SessionUser } from "@/lib/sync/types";
import { clearLocalData, getMeta, setMeta } from "./db";
import { stopSync } from "./sync-engine";

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

export async function signedOut() {
    stopSync();
    await clearLocalData();
    setState({ status: "anonymous" });
}

export async function updateCachedUser(patch: Partial<SessionUser>) {
    if (state.status !== "authenticated") return;
    const user = { ...state.user, ...patch };
    await setMeta("user", user);
    setState({ status: "authenticated", user });
}
