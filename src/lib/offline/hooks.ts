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
            meters: meters
                .map((m) => ({ ...m, readings: (readingsByMeter.get(m.id) ?? []).sort((a, b) => a.date.localeCompare(b.date)) }))
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
            lists: lists
                .map((l) => ({ ...l, items: (itemsByList.get(l.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
                .sort(byCreatedDesc),
            notes: notes.sort(byCreatedDesc),
        };
    }, [householdId]);
}
