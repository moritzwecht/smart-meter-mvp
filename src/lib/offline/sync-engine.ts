import type { EntityTable, Table } from "dexie";
import type { Household, SyncResponse } from "@/lib/sync/types";
import { db, getMeta, setMeta, type OutboxEntry } from "./db";

/*
 * Sync-Engine (Client)
 * ====================
 * - Läuft nach jeder lokalen Änderung (gebündelt), beim Start, beim Wieder-Online-
 *   Gehen, beim Zurückkehren in die App und alle 30 s, solange die App sichtbar ist.
 * - Pro Durchlauf: Outbox-Batch senden + Änderungen seit dem Cursor holen – ein Request.
 * - Arbeitet die Outbox vollständig ab (auch Änderungen, die während eines laufenden
 *   Syncs entstehen) und blockiert nie: abgelehnte Operationen werden verworfen und
 *   der echte Stand neu geladen; Netzwerkfehler werden mit Backoff wiederholt.
 * - Mehrere Tabs koordinieren sich über die Web Locks API.
 */

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "unauthenticated";

export interface SyncState {
    status: SyncStatus;
    lastSyncedAt: string | null;
    error: string | null;
}

const BATCH_SIZE = 100;
const LEGACY_CHUNK_SIZE = 200;
const REQUEST_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 30_000;
const DEBOUNCE_MS = 250;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

let state: SyncState = { status: "idle", lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();

let running = false;
let rerunRequested = false;
let fullSyncRequested = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let retryAttempt = 0;
let started = false;
/** Wird bei stopSync erhöht: Antworten laufender Requests (z. B. nach Logout) werden verworfen. */
let generation = 0;
let onUnauthenticated: (() => void) | undefined;
/** Nutzer, dem die lokalen Daten gehören (wird mitgeschickt, s. isUserMismatch) */
let currentUserId: number | undefined;

function setState(patch: Partial<SyncState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
}

export function getSyncState(): SyncState {
    return state;
}

export function subscribeSyncState(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

class UnauthenticatedError extends Error {}

class HttpError extends Error {
    constructor(readonly status: number) {
        super(`Sync fehlgeschlagen (${status})`);
    }
}

/** Netzwerk nicht erreichbar oder Request hängt – wie offline behandeln. */
function isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) return true;
    return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

/** Sync anstoßen (gebündelt). `full` lädt den kompletten Bestand neu. */
export function requestSync(options: { full?: boolean; immediate?: boolean } = {}) {
    if (options.full) fullSyncRequested = true;
    if (!started) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void runSync(), options.immediate ? 0 : DEBOUNCE_MS);
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (locks?.request) return locks.request("myhome-sync", fn) as Promise<T>;
    return fn();
}

export async function runSync(): Promise<void> {
    if (running) {
        rerunRequested = true;
        return;
    }
    if (!isOnline()) {
        setState({ status: "offline" });
        return;
    }
    running = true;
    clearTimeout(retryTimer);
    setState({ status: "syncing", error: null });
    try {
        do {
            rerunRequested = false;
            await withLock(async () => {
                await uploadLegacyQueue().catch((error) => {
                    // Darf den normalen Sync nie blockieren
                    if (error instanceof UnauthenticatedError || isNetworkError(error)) throw error;
                    console.warn("[sync] Übernahme aus Version 1 fehlgeschlagen", error);
                });
                let rounds = 0;
                while ((await syncRound()) && rounds++ < 50) {
                    /* weiter, bis die Outbox leer ist */
                }
            });
        } while (rerunRequested && isOnline());
        retryAttempt = 0;
        setState({ status: isOnline() ? "idle" : "offline", lastSyncedAt: new Date().toISOString(), error: null });
    } catch (error) {
        if (error instanceof UnauthenticatedError) {
            setState({ status: "unauthenticated", error: null });
            if (started) onUnauthenticated?.(); // nach einem Logout nicht mehr reagieren
        } else {
            // Netzwerk nicht erreichbar (auch wenn navigator.onLine "true" meldet,
            // z. B. im Funkloch oder WLAN ohne Internet) → wie offline behandeln.
            const unreachable = !isOnline() || isNetworkError(error);
            setState(
                unreachable
                    ? { status: "offline", error: null }
                    : { status: "error", error: error instanceof Error ? error.message : String(error) },
            );
            if (started) {
                const delay = RETRY_DELAYS_MS[Math.min(retryAttempt++, RETRY_DELAYS_MS.length - 1)];
                retryTimer = setTimeout(() => void runSync(), delay);
            }
        }
    } finally {
        running = false;
    }
}

async function postJson(url: string, body: unknown): Promise<Response> {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(currentUserId !== undefined ? { "X-MyHome-User": String(currentUserId) } : {}),
        },
        body: JSON.stringify(body),
        credentials: "same-origin",
        cache: "no-store",
        // Ein hängender Request (Funkloch, App im Hintergrund) darf den Sync nicht ewig blockieren
        signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
    });
    // 409 = anderes Konto im Browser angemeldet → wie abgelaufene Session behandeln
    if (res.status === 401 || res.status === 409) throw new UnauthenticatedError();
    if (!res.ok) throw new HttpError(res.status);
    return res;
}

const newUid = () => crypto.randomUUID();

/**
 * Bereitet die alte Queue einmalig vor: Jede Operation bekommt eine feste UUID und
 * Verweise auf temporäre (negative) IDs werden durch diese UUIDs ersetzt. Danach
 * ist jeder Eintrag für sich verständlich – die Übertragung kann in Teilen erfolgen
 * und nach einem Abbruch gefahrlos wiederholt werden.
 */
async function prepareLegacyQueue() {
    await db.transaction("rw", db.legacyQueue, async () => {
        const entries = await db.legacyQueue.orderBy("id").toArray();
        if (entries.every((e) => e.uid)) return;
        const temp = new Map<string, string>();
        const ref = (entity: string, value: unknown) => {
            const n = Number(value);
            return Number.isInteger(n) && n < 0 ? (temp.get(`${entity}:${n}`) ?? value) : value;
        };
        for (const entry of entries) {
            const uid = entry.uid ?? newUid();
            const data = { ...entry.data };
            if (!entry.uid) {
                if (entry.type === "CREATE") {
                    if (data.tempId !== undefined) temp.set(`${entry.entity}:${Number(data.tempId)}`, uid);
                    if (entry.entity === "READING") data.meterId = ref("METER", data.meterId);
                    if (entry.entity === "ITEM") data.listId = ref("LIST", data.listId);
                } else {
                    data.id = ref(entry.entity, data.id);
                }
            }
            await db.legacyQueue.update(entry.id!, { uid, data });
        }
    });
}

/** Einmalige Übernahme hängengebliebener Offline-Änderungen aus Version 1. */
async function uploadLegacyQueue() {
    if ((await db.legacyQueue.count()) === 0) return;
    await prepareLegacyQueue();
    for (;;) {
        const chunk = await db.legacyQueue.orderBy("id").limit(LEGACY_CHUNK_SIZE).toArray();
        if (!chunk.length) break;
        try {
            await postJson("/api/sync/legacy", { ops: chunk.map(({ type, entity, data, timestamp, uid }) => ({ type, entity, data, timestamp, uid })) });
        } catch (error) {
            // Vom Server abgelehnt (z. B. unlesbare Daten): Wiederholen hilft nicht → verwerfen
            if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
                await db.legacyQueue.bulkDelete(chunk.map((l) => l.id!));
                continue;
            }
            throw error;
        }
        await db.legacyQueue.bulkDelete(chunk.map((l) => l.id!));
    }
    await db.meta.delete("cursor"); // danach einmal alles neu laden
}

/** Ein Push/Pull-Durchlauf. Gibt `true` zurück, wenn direkt noch einer nötig ist. */
async function syncRound(): Promise<boolean> {
    const gen = generation;
    const batch = await db.transaction("rw", db.outbox, async () => {
        const entries = await db.outbox.orderBy("seq").limit(BATCH_SIZE).toArray();
        await Promise.all(entries.map((e) => db.outbox.update(e.seq!, { sending: 1, attempted: 1 })));
        return entries;
    });

    const full = fullSyncRequested;
    const since = full ? null : ((await getMeta<string>("cursor")) ?? null);
    let response: SyncResponse;
    try {
        const res = await postJson("/api/sync", { since, ops: batch.map((e) => e.op) });
        response = (await res.json()) as SyncResponse;
    } catch (error) {
        // Nichts verloren: Operationen bleiben in der Outbox und werden erneut gesendet
        // (der Server verarbeitet sie idempotent).
        await db.outbox.bulkUpdate(batch.map((e) => ({ key: e.seq!, changes: { sending: 0 as const } })));
        throw error;
    }

    if (gen !== generation) return false; // inzwischen abgemeldet → nichts mehr schreiben
    if (full) fullSyncRequested = false;
    const needsFull = await applyResponse(batch, response);
    return needsFull || fullSyncRequested || (await db.outbox.count()) > 0;
}

type Row = { id: string | number; deletedAt?: string | null };

async function applyResponse(batch: OutboxEntry[], res: SyncResponse): Promise<boolean> {
    let needsFull = res.results.some((r) => r.status === "rejected");
    if (res.results.some((r) => r.status === "rejected")) {
        console.warn("[sync] Abgelehnte Operationen:", res.results.filter((r) => r.status === "rejected"));
    }

    await db.transaction(
        "rw",
        [db.outbox, db.meta, db.households, db.meters, db.readings, db.todoLists, db.todoItems, db.notes],
        async () => {
            await db.outbox.bulkDelete(batch.map((e) => e.seq!));
            const pendingIds = new Set((await db.outbox.toArray()).map((e) => e.entityId));

            // Haushalte: verschwundene (gelöscht / entfernt) samt Daten lokal entfernen
            const householdIds = new Set(res.households.map((h) => h.id));
            const known = (await getMeta<number[]>("knownHouseholds")) ?? [];
            if (!res.reset && res.households.some((h) => !known.includes(h.id))) needsFull = true; // neu beigetreten
            const gone = (await db.households.toArray()).filter((h) => !householdIds.has(h.id)).map((h) => h.id);
            if (gone.length) await removeHouseholdData(gone);
            await db.households.bulkPut(res.households as Household[]);
            await setMeta("knownHouseholds", [...householdIds]);

            if (res.reset) {
                await replaceAll(db.meters, res.meters, pendingIds, (m) => householdIds.has(m.householdId));
                // Ablesungen/Punkte lokal angelegter (noch ausstehender) Zähler/Listen sind über pendingIds geschützt
                await replaceAll(db.readings, res.readings, pendingIds, () => true);
                await replaceAll(db.todoLists, res.lists, pendingIds, (l) => householdIds.has(l.householdId));
                await replaceAll(db.todoItems, res.items, pendingIds, () => true);
                await replaceAll(db.notes, res.notes, pendingIds, (n) => householdIds.has(n.householdId));
            } else {
                await mergeDelta(db.meters, res.meters, pendingIds, async (id) => {
                    await db.readings.where("meterId").equals(id).delete();
                });
                await mergeDelta(db.readings, res.readings, pendingIds);
                await mergeDelta(db.todoLists, res.lists, pendingIds, async (id) => {
                    await db.todoItems.where("listId").equals(id).delete();
                });
                await mergeDelta(db.todoItems, res.items, pendingIds);
                await mergeDelta(db.notes, res.notes, pendingIds);
            }
            // Vollabgleich nötig → Cursor verwerfen statt nur ein Flag im Speicher zu setzen:
            // So holt auch ein Neustart der App (oder ein Fehler im nächsten Durchlauf)
            // garantiert alles nach.
            if (needsFull) await db.meta.delete("cursor");
            else await setMeta("cursor", res.cursor);
            await setMeta("lastSyncedAt", new Date().toISOString());
        },
    );
    return needsFull;
}

/** Vollabgleich: Server-Stand übernehmen, lokal unbekannte Datensätze entfernen – außer ausstehenden. */
async function replaceAll<T extends Row & { id: string }>(
    table: EntityTable<T, "id">,
    rows: T[],
    pendingIds: Set<string>,
    inScope: (row: T) => boolean,
) {
    const t = table as unknown as Table<T, string, T>;
    const serverIds = new Set(rows.map((r) => r.id));
    const stale = (await t.toArray()).filter((r) => !serverIds.has(r.id) && !pendingIds.has(r.id) && inScope(r));
    if (stale.length) await t.bulkDelete(stale.map((r) => r.id));
    await t.bulkPut(rows.filter((r) => !pendingIds.has(r.id)));
}

/** Delta: geänderte Datensätze übernehmen, Löschungen anwenden. Lokal ausstehende Änderungen gewinnen. */
async function mergeDelta<T extends Row & { id: string }>(
    table: EntityTable<T, "id">,
    rows: T[],
    pendingIds: Set<string>,
    onDelete?: (id: string) => Promise<void>,
) {
    const t = table as unknown as Table<T, string, T>;
    const upserts: T[] = [];
    for (const row of rows) {
        const id = row.id;
        if (pendingIds.has(id)) continue;
        if (row.deletedAt) {
            await t.delete(id);
            await onDelete?.(id);
        } else {
            upserts.push(row);
        }
    }
    if (upserts.length) await t.bulkPut(upserts);
}

async function removeHouseholdData(householdIds: number[]) {
    const meterIds = (await db.meters.where("householdId").anyOf(householdIds).primaryKeys()) as string[];
    const listIds = (await db.todoLists.where("householdId").anyOf(householdIds).primaryKeys()) as string[];
    await db.readings.where("meterId").anyOf(meterIds).delete();
    await db.todoItems.where("listId").anyOf(listIds).delete();
    await db.meters.bulkDelete(meterIds);
    await db.todoLists.bulkDelete(listIds);
    await db.notes.where("householdId").anyOf(householdIds).delete();
    await db.households.bulkDelete(householdIds);
}

// Lebenszyklus ------------------------------------------------------------------------

function handleOnline() {
    requestSync({ immediate: true });
}

function handleOffline() {
    setState({ status: "offline" });
}

function handleVisibility() {
    if (document.visibilityState === "visible") requestSync({ immediate: true });
}

/** Startet den Hintergrund-Sync für den angemeldeten Nutzer. */
export async function startSync(options: { userId?: number; onUnauthenticated?: () => void } = {}) {
    onUnauthenticated = options.onUnauthenticated;
    currentUserId = options.userId;
    if (started) {
        requestSync({ immediate: true });
        return;
    }
    started = true;
    // Absturz während des Sendens? Operationen wieder freigeben (der Server ist idempotent).
    // Unter dem Lock, damit ein anderer Tab nicht mitten in seinem Sync gestört wird.
    await withLock(() => db.outbox.where("seq").above(0).modify({ sending: 0 }));
    setState({ lastSyncedAt: (await getMeta<string>("lastSyncedAt")) ?? null });
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    pollTimer = setInterval(() => {
        if (document.visibilityState === "visible") requestSync();
    }, POLL_INTERVAL_MS);
    requestSync({ immediate: true });
}

export function stopSync() {
    generation++;
    if (!started) return;
    started = false;
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    clearInterval(pollTimer);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    document.removeEventListener("visibilitychange", handleVisibility);
    setState({ status: "idle", error: null });
}

/** Nur für Tests: Nutzer setzen, ohne die Browser-Listener zu starten */
export function setSyncUserForTests(userId: number | undefined) {
    currentUserId = userId;
}

/** Nur für Tests */
export function resetSyncEngineForTests() {
    stopSync();
    running = false;
    rerunRequested = false;
    fullSyncRequested = false;
    retryAttempt = 0;
    state = { status: "idle", lastSyncedAt: null, error: null };
}
