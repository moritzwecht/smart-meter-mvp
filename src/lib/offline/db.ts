import Dexie, { type EntityTable } from "dexie";
import type { Household, Meter, Note, Reading, SessionUser, SyncOp, TodoItem, TodoList } from "@/lib/sync/types";

/*
 * Lokale Datenbank (IndexedDB über Dexie) – die einzige Datenquelle der UI.
 * Änderungen landen sofort hier und zusätzlich in der Outbox; der Sync schiebt
 * sie im Hintergrund zum Server und holt Änderungen anderer Geräte ab.
 */

export interface OutboxEntry {
    seq?: number;
    entityId: string;
    op: SyncOp;
    /** 1 = wird gerade gesendet (darf nicht mehr zusammengeführt werden) */
    sending: 0 | 1;
    queuedAt: number;
}

export interface MetaEntry {
    key: string;
    value: unknown;
}

/** Eintrag aus der alten Sync-Queue (Version 1), wird einmalig zum Server übertragen. */
export interface LegacyQueueEntry {
    id?: number;
    type: "CREATE" | "UPDATE" | "DELETE";
    entity: "METER" | "READING" | "LIST" | "ITEM" | "NOTE" | "HOUSEHOLD";
    data: Record<string, unknown>;
    timestamp?: number;
}

export type MetaKey = "user" | "cursor" | "knownHouseholds" | "selectedHouseholdId" | "lastSyncedAt";

export class MyHomeDatabase extends Dexie {
    households!: EntityTable<Household, "id">;
    meters!: EntityTable<Meter, "id">;
    readings!: EntityTable<Reading, "id">;
    todoLists!: EntityTable<TodoList, "id">;
    todoItems!: EntityTable<TodoItem, "id">;
    notes!: EntityTable<Note, "id">;
    outbox!: EntityTable<OutboxEntry, "seq">;
    meta!: EntityTable<MetaEntry, "key">;
    legacyQueue!: EntityTable<LegacyQueueEntry, "id">;

    constructor(name = "MyHomeDB") {
        // IndexedDB explizit übergeben (im Browser identisch mit dem Default; in Tests
        // bekommt so jedes simulierte Gerät seine eigene Datenbank).
        super(name, { indexedDB: globalThis.indexedDB, IDBKeyRange: globalThis.IDBKeyRange });

        // Version 1 (bis App-Version 1.4): Integer-IDs und eine fehleranfällige Sync-Queue.
        this.version(1).stores({
            households: "id, name, userId",
            meters: "id, name, type, householdId",
            readings: "id, meterId, date",
            todoLists: "id, name, householdId",
            todoItems: "id, listId, content",
            notes: "id, title, householdId",
            syncQueue: "++id, type, entity, status, timestamp",
        });

        // Version 2: UUIDs, Outbox, Metadaten. Alte Daten werden verworfen (sie kommen
        // frisch vom Server); noch nicht synchronisierte Änderungen werden aufbewahrt.
        this.version(2)
            .stores({
                households: "id",
                meters: "id, householdId",
                readings: "id, meterId",
                todoLists: "id, householdId",
                todoItems: "id, listId",
                notes: "id, householdId",
                syncQueue: "++id",
                outbox: "++seq, entityId",
                meta: "key",
                legacyQueue: "++id",
            })
            .upgrade(async (tx) => {
                const pending = await tx.table("syncQueue").toArray();
                if (pending.length) {
                    await tx.table("legacyQueue").bulkAdd(
                        pending.map(({ type, entity, data, timestamp }) => ({ type, entity, data, timestamp })),
                    );
                }
                await Promise.all(
                    ["households", "meters", "readings", "todoLists", "todoItems", "notes"].map((t) => tx.table(t).clear()),
                );
            });

        this.version(3).stores({ syncQueue: null });
    }
}

export const db = new MyHomeDatabase();

export async function getMeta<T>(key: MetaKey): Promise<T | undefined> {
    return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: MetaKey, value: unknown) {
    await db.meta.put({ key, value });
}

/** Löscht alle lokalen Daten (Logout, anderer Nutzer). */
export async function clearLocalData() {
    await db.transaction("rw", [db.households, db.meters, db.readings, db.todoLists, db.todoItems, db.notes, db.outbox, db.meta, db.legacyQueue], async () => {
        await Promise.all([
            db.households.clear(),
            db.meters.clear(),
            db.readings.clear(),
            db.todoLists.clear(),
            db.todoItems.clear(),
            db.notes.clear(),
            db.outbox.clear(),
            db.meta.clear(),
            db.legacyQueue.clear(),
        ]);
    });
}

export type SessionUserCache = SessionUser;
