import type {
    Meter,
    MeterFields,
    Note,
    NoteFields,
    Reading,
    ReadingFields,
    SyncOp,
    TodoItem,
    TodoList,
} from "@/lib/sync/types";
import { db } from "./db";
import { enqueue } from "./outbox";
import { requestSync } from "./sync-engine";

/*
 * Alle Schreiboperationen der App. Updates auf nicht (mehr) vorhandene Datensätze
 * sind No-ops – so entstehen keine Operationen, die der Server ablehnen müsste.
 * Jede Änderung:
 *   1. wird sofort lokal gespeichert (UI aktualisiert sich über liveQuery),
 *   2. landet als Operation in der Outbox (gleiche Transaktion → nie inkonsistent),
 *   3. stößt einen Sync an (gebündelt, funktioniert auch offline).
 */

export function newId(): string {
    const c = globalThis.crypto;
    if (typeof c.randomUUID === "function") return c.randomUUID();
    // Fallback für ältere Browser / unsichere Kontexte
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const opId = newId;
const nowIso = () => new Date().toISOString();

const METER_NAMES: Record<string, string> = { ELECTRICITY: "Strom", WATER: "Wasser", GAS: "Gas" };

const allTables = [db.meters, db.readings, db.todoLists, db.todoItems, db.notes, db.outbox];

async function write(fn: () => Promise<void>) {
    await db.transaction("rw", allTables, fn);
    requestSync();
}

async function op(o: SyncOp) {
    await enqueue(o);
}

// Zähler ---------------------------------------------------------------------------

export const DEFAULT_METER_FIELDS: MeterFields = {
    type: "ELECTRICITY",
    unit: "kWh",
    isPinned: false,
    monthlyPayment: null,
    basicFee: null,
    pricePerUnit: null,
    priceUnit: null,
    zNumber: null,
    calorificValue: null,
    billingStart: null,
};

export async function addMeter(householdId: number, fields: Partial<MeterFields> & Pick<MeterFields, "type" | "unit">) {
    const id = newId();
    const createdAt = nowIso();
    const meter: Meter = {
        ...DEFAULT_METER_FIELDS,
        ...fields,
        id,
        householdId,
        name: METER_NAMES[fields.type] ?? "Zähler",
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
    };
    await write(async () => {
        await db.meters.add(meter);
        await op({ opId: opId(), entity: "meter", action: "create", id, householdId, fields, createdAt });
    });
    return id;
}

export async function updateMeter(id: string, fields: Partial<MeterFields>) {
    await write(async () => {
        const changes: Partial<Meter> = { ...fields, updatedAt: nowIso() };
        if (fields.type) changes.name = METER_NAMES[fields.type] ?? "Zähler";
        if (!(await db.meters.update(id, changes))) return;
        await op({ opId: opId(), entity: "meter", action: "update", id, fields });
    });
}

export async function deleteMeter(id: string) {
    await write(async () => {
        await db.readings.where("meterId").equals(id).delete();
        await db.meters.delete(id);
        await op({ opId: opId(), entity: "meter", action: "delete", id });
    });
}

// Ablesungen -------------------------------------------------------------------------

export async function addReading(meterId: string, fields: ReadingFields) {
    const id = newId();
    const createdAt = nowIso();
    const reading: Reading = { ...fields, id, meterId, source: "app", createdAt, updatedAt: createdAt, deletedAt: null };
    await write(async () => {
        await db.readings.add(reading);
        await op({ opId: opId(), entity: "reading", action: "create", id, parentId: meterId, fields, createdAt });
    });
    return id;
}

export async function updateReading(id: string, fields: Partial<ReadingFields>) {
    await write(async () => {
        if (!(await db.readings.update(id, { ...fields, updatedAt: nowIso() }))) return;
        await op({ opId: opId(), entity: "reading", action: "update", id, fields });
    });
}

export async function deleteReading(id: string) {
    await write(async () => {
        await db.readings.delete(id);
        await op({ opId: opId(), entity: "reading", action: "delete", id });
    });
}

// Listen -------------------------------------------------------------------------------

export async function addList(householdId: number, name: string) {
    const id = newId();
    const createdAt = nowIso();
    const list: TodoList = { id, householdId, name, isPinned: false, createdAt, updatedAt: createdAt, deletedAt: null };
    await write(async () => {
        await db.todoLists.add(list);
        await op({ opId: opId(), entity: "list", action: "create", id, householdId, fields: { name, isPinned: false }, createdAt });
    });
    return id;
}

export async function updateList(id: string, fields: Partial<Pick<TodoList, "name" | "isPinned">>) {
    await write(async () => {
        if (!(await db.todoLists.update(id, { ...fields, updatedAt: nowIso() }))) return;
        await op({ opId: opId(), entity: "list", action: "update", id, fields });
    });
}

export async function deleteList(id: string) {
    await write(async () => {
        await db.todoItems.where("listId").equals(id).delete();
        await db.todoLists.delete(id);
        await op({ opId: opId(), entity: "list", action: "delete", id });
    });
}

export async function addItem(listId: string, content: string) {
    const id = newId();
    const createdAt = nowIso();
    const item: TodoItem = { id, listId, content, completed: false, createdAt, updatedAt: createdAt, deletedAt: null };
    await write(async () => {
        await db.todoItems.add(item);
        await op({ opId: opId(), entity: "item", action: "create", id, parentId: listId, fields: { content, completed: false }, createdAt });
    });
    return id;
}

export async function updateItem(id: string, fields: Partial<Pick<TodoItem, "content" | "completed">>) {
    await write(async () => {
        if (!(await db.todoItems.update(id, { ...fields, updatedAt: nowIso() }))) return;
        await op({ opId: opId(), entity: "item", action: "update", id, fields });
    });
}

export async function deleteItem(id: string) {
    await write(async () => {
        await db.todoItems.delete(id);
        await op({ opId: opId(), entity: "item", action: "delete", id });
    });
}

/** Entfernt alle erledigten Punkte einer Liste (z. B. nach dem Einkauf). */
export async function clearCompletedItems(listId: string) {
    await write(async () => {
        const done = await db.todoItems.where("listId").equals(listId).filter((i) => i.completed).toArray();
        await db.todoItems.bulkDelete(done.map((i) => i.id));
        for (const item of done) await op({ opId: opId(), entity: "item", action: "delete", id: item.id });
    });
}

// Notizen ------------------------------------------------------------------------------

export async function addNote(householdId: number, fields: Partial<NoteFields> = {}) {
    const id = newId();
    const createdAt = nowIso();
    const note: Note = {
        id,
        householdId,
        title: fields.title ?? "",
        content: fields.content ?? null,
        isPinned: fields.isPinned ?? false,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
    };
    await write(async () => {
        await db.notes.add(note);
        await op({
            opId: opId(),
            entity: "note",
            action: "create",
            id,
            householdId,
            fields: { title: note.title, content: note.content, isPinned: note.isPinned },
            createdAt,
        });
    });
    return id;
}

export async function updateNote(id: string, fields: Partial<NoteFields>) {
    await write(async () => {
        // Gelöscht (z. B. verspätetes Autosave nach dem Löschen) → nichts vormerken
        if (!(await db.notes.update(id, { ...fields, updatedAt: nowIso() }))) return;
        await op({ opId: opId(), entity: "note", action: "update", id, fields });
    });
}

export async function deleteNote(id: string) {
    await write(async () => {
        await db.notes.delete(id);
        await op({ opId: opId(), entity: "note", action: "delete", id });
    });
}
