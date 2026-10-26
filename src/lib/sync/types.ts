/*
 * Gemeinsame Typen für Client und Server (reine Typen – kein Laufzeitcode).
 *
 * Alle Datensätze liegen auf dem Client in IndexedDB in genau dieser Form.
 * Datumswerte sind ISO-Strings (UTC), Zahlen echte Zahlen, Booleans echte Booleans.
 */

export type MeterType = "ELECTRICITY" | "GAS" | "WATER";
export type Role = "OWNER" | "MEMBER";

export interface Household {
    id: number;
    name: string;
    role: Role;
}

interface SyncedRow {
    id: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}

export interface MeterFields {
    type: MeterType;
    unit: string;
    isPinned: boolean;
    monthlyPayment: number | null;
    basicFee: number | null;
    pricePerUnit: number | null;
    /** 'kwh' = Preis pro kWh, sonst gilt die Zählereinheit. */
    priceUnit: string | null;
    zNumber: number | null;
    calorificValue: number | null;
    /** Beginn des Abrechnungsjahres, YYYY-MM-DD. */
    billingStart: string | null;
    /** Eigener Name (z. B. „Wärmepumpe“); leer = Typ. Nur beim Anlegen/Ändern mitgeschickt. */
    name?: string;
}

export interface Meter extends SyncedRow, MeterFields {
    householdId: number;
    name: string;
}

export interface ReadingFields {
    value: number;
    date: string;
    isReplacement: boolean;
}

export interface Reading extends SyncedRow, ReadingFields {
    meterId: string;
    source: string;
}

export interface TodoListFields {
    name: string;
    isPinned: boolean;
}

export interface TodoList extends SyncedRow, TodoListFields {
    householdId: number;
}

export interface TodoItemFields {
    content: string;
    completed: boolean;
}

export interface TodoItem extends SyncedRow, TodoItemFields {
    listId: string;
}

export interface NoteFields {
    title: string;
    content: string | null;
    isPinned: boolean;
}

export interface Note extends SyncedRow, NoteFields {
    householdId: number;
}

export type EntityName = "meter" | "reading" | "list" | "item" | "note";

export interface EntityFieldMap {
    meter: MeterFields;
    reading: ReadingFields;
    list: TodoListFields;
    item: TodoItemFields;
    note: NoteFields;
}

/**
 * Eine Änderung aus der Outbox des Clients. Operationen sind idempotent:
 * dieselbe Operation zweimal zu schicken (z. B. nach Verbindungsabbruch) ist harmlos.
 */
export type SyncOp = {
    [E in EntityName]:
        | {
              opId: string;
              entity: E;
              action: "create";
              id: string;
              /** Haushalt (Zähler, Listen, Notizen) */
              householdId?: number;
              /** Elterndatensatz (Ablesung → Zähler, Punkt → Liste) */
              parentId?: string;
              fields: Partial<EntityFieldMap[E]>;
              createdAt?: string;
          }
        | { opId: string; entity: E; action: "update"; id: string; fields: Partial<EntityFieldMap[E]> }
        | { opId: string; entity: E; action: "delete"; id: string };
}[EntityName];

export type OpStatus = "ok" | "rejected";

export interface OpResult {
    opId: string;
    status: OpStatus;
    reason?: string;
}

export interface SyncRequest {
    /** Cursor aus der letzten Antwort; `null` = vollständiger Abgleich. */
    since: string | null;
    ops: SyncOp[];
}

export interface SyncChanges {
    /** `true`, wenn die Antwort den kompletten Bestand enthält (statt nur Änderungen). */
    reset: boolean;
    cursor: string;
    households: Household[];
    meters: Meter[];
    readings: Reading[];
    lists: TodoList[];
    items: TodoItem[];
    notes: Note[];
}

export interface SyncResponse extends SyncChanges {
    results: OpResult[];
}

export interface SessionUser {
    id: number;
    email: string;
    name: string;
}
