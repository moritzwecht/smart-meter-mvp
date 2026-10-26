"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import type { Household, Meter, Note, Reading, TodoItem, TodoList } from "@/lib/sync/types";
import { db } from "./db";
import { sessionStore } from "./session";
import { getSyncState, subscribeSyncState, type SyncState } from "./sync-engine";

export function useSession() {
    return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.getServer);
}

const serverSyncState: SyncState = { status: "idle", lastSyncedAt: null, error: null };

export function useSyncState() {
    return useSyncExternalStore(subscribeSyncState, getSyncState, () => serverSyncState);
}

export function usePendingCount(): number {
    return useLiveQuery(() => db.outbox.count(), [], 0);
}

/** `undefined`, solange IndexedDB noch lädt. */
export function useHouseholds(): Household[] | undefined {
    return useLiveQuery(() => db.households.toArray(), []);
}

export interface MeterWithReadings extends Meter {
    /** Chronologisch aufsteigend */
    readings: Reading[];
}

export interface ListWithItems extends TodoList {
    items: TodoItem[];
}

export interface HouseholdData {
    meters: MeterWithReadings[];
    lists: ListWithItems[];
    notes: Note[];
}

const byCreatedDesc = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

/*
 * Strukturelles Teilen: Dexie liefert bei jeder Änderung frische Objekte. Unveränderte
 * Datensätze bekommen hier ihr bisheriges Objekt zurück – so rendern die (memoisierten)
 * Widgets nur neu, wenn sich *ihre* Daten geändert haben, und z. B. die Verbrauchs-
 * berechnung läuft nicht bei jedem Tastendruck in einer Notiz für alle Zähler neu.
 */
function shallowEqual(a: object, b: object, skip?: string): boolean {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) {
        if (k !== skip && (a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
    }
    return true;
}

function sameChildren<T extends object>(a: T[], b: T[]): boolean {
    return a.length === b.length && a.every((x, i) => x === b[i] || shallowEqual(x, b[i]));
}

const shared = {
    meters: new Map<string, MeterWithReadings>(),
    lists: new Map<string, ListWithItems>(),
    notes: new Map<string, Note>(),
};

function reuse<T extends { id: string }>(cache: Map<string, T>, next: T[], equal: (a: T, b: T) => boolean): T[] {
    const result = next.map((item) => {
        const prev = cache.get(item.id);
        return prev && equal(prev, item) ? prev : item;
    });
    for (const item of result) cache.set(item.id, item);
    if (cache.size > result.length * 2 + 50) {
        const keep = new Set(result.map((r) => r.id));
        for (const id of cache.keys()) if (!keep.has(id)) cache.delete(id);
    }
    return result;
}

/** Alle Daten eines Haushalts – aktualisiert sich automatisch bei jeder Änderung. */
export function useHouseholdData(householdId: number | null): HouseholdData | undefined {
    return useLiveQuery(async () => {
        if (householdId === null) return { meters: [], lists: [], notes: [] };
        const [meters, lists, notes] = await Promise.all([
            db.meters.where("householdId").equals(householdId).toArray(),
            db.todoLists.where("householdId").equals(householdId).toArray(),
            db.notes.where("householdId").equals(householdId).toArray(),
        ]);
        const [readings, items] = await Promise.all([
            meters.length ? db.readings.where("meterId").anyOf(meters.map((m) => m.id)).toArray() : [],
            lists.length ? db.todoItems.where("listId").anyOf(lists.map((l) => l.id)).toArray() : [],
        ]);

        const readingsByMeter = new Map<string, Reading[]>();
        for (const r of readings) {
            const arr = readingsByMeter.get(r.meterId);
            if (arr) arr.push(r);
            else readingsByMeter.set(r.meterId, [r]);
        }
        const itemsByList = new Map<string, TodoItem[]>();
        for (const i of items) {
            const arr = itemsByList.get(i.listId);
            if (arr) arr.push(i);
            else itemsByList.set(i.listId, [i]);
        }

        return {
            meters: reuse(
                shared.meters,
                meters
                    .map((m) => ({ ...m, readings: (readingsByMeter.get(m.id) ?? []).sort((a, b) => a.date.localeCompare(b.date)) }))
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
                (a, b) => shallowEqual(a, b, "readings") && sameChildren(a.readings, b.readings),
            ),
            lists: reuse(
                shared.lists,
                lists
                    .map((l) => ({ ...l, items: (itemsByList.get(l.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
                    .sort(byCreatedDesc),
                (a, b) => shallowEqual(a, b, "items") && sameChildren(a.items, b.items),
            ),
            notes: reuse(shared.notes, notes.sort(byCreatedDesc), (a, b) => shallowEqual(a, b)),
        };
    }, [householdId]);
}
