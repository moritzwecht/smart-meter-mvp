import "server-only";
import { and, eq, getTableColumns, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { meters, notes, readings, todoItems, todoLists } from "@/lib/db/schema";
import {
    itemFieldsSchema,
    listFieldsSchema,
    meterFieldsSchema,
    noteFieldsSchema,
    readingFieldsSchema,
    type ParsedSyncOp,
} from "@/lib/sync/schemas";
import type { Household, Meter, Note, OpResult, Reading, SyncChanges, TodoItem, TodoList } from "@/lib/sync/types";
import { resolveMeterName, STANDARD_METER_NAMES } from "@/lib/meter/names";
import { getDb } from "./db";

/*
 * Server-Seite des Offline-Syncs
 * ==============================
 * Push: Operationen werden der Reihe nach angewendet. Jede ist idempotent
 *   (create = INSERT … ON CONFLICT DO NOTHING, update = Felder setzen,
 *   delete = Soft-Delete). Dauerhaft ungültige Operationen (kein Zugriff,
 *   Datensatz gelöscht, ungültige Daten) werden als `rejected` gemeldet – der
 *   Client verwirft sie und holt den echten Stand. Sie blockieren nie die Queue.
 * Pull: alle Änderungen seit dem Cursor (inkl. Löschungen), oder bei `reset`
 *   den kompletten Bestand.
 */

export interface SyncContext {
    userId: number;
    householdIds: number[];
}


/** Nach dieser Zeit ohne Sync gibt es statt eines Deltas den vollen Bestand (Tombstones werden aufgeräumt). */
export const FULL_SYNC_AFTER_DAYS = 30;
/** Überlappung des Cursors, damit Änderungen aus gleichzeitig laufenden Transaktionen nicht verloren gehen. */
const CURSOR_OVERLAP_MS = 30_000;

const createSchemas = {
    meter: meterFieldsSchema.partial().required({ type: true, unit: true }),
    reading: readingFieldsSchema.partial().required({ value: true, date: true }),
    list: listFieldsSchema.partial().required({ name: true }),
    item: itemFieldsSchema.partial().required({ content: true }),
    note: noteFieldsSchema.partial(),
};

const updateSchemas = {
    meter: meterFieldsSchema.partial(),
    reading: readingFieldsSchema.partial(),
    list: listFieldsSchema.partial(),
    item: itemFieldsSchema.partial(),
    note: noteFieldsSchema.partial(),
};

const ok = (opId: string): OpResult => ({ opId, status: "ok" });
const rejected = (opId: string, reason: string): OpResult => ({ opId, status: "rejected", reason });

/** Datenfehler (Constraint, Typ) sind dauerhaft → rejected. Alles andere (Verbindung …) → Retry. */
function isPermanentDbError(error: unknown): boolean {
    let e: unknown = error;
    for (let i = 0; i < 3 && e && typeof e === "object"; i++) {
        const code = (e as { code?: unknown }).code;
        if (typeof code === "string" && /^(22|23)/.test(code)) return true;
        e = (e as { cause?: unknown }).cause;
    }
    return false;
}

function clampCreatedAt(value: string | undefined): Date {
    const now = Date.now();
    const t = value ? Date.parse(value) : NaN;
    if (Number.isFinite(t) && t > now - 10 * 365 * 86_400_000 && t < now + 86_400_000) return new Date(t);
    return new Date(now);
}

function withDates<T extends { date?: string }>(fields: T) {
    const { date, ...rest } = fields;
    return date === undefined ? rest : { ...rest, date: new Date(date) };
}

function hasKeys(o: object) {
    return Object.keys(o).length > 0;
}

/** Zugreifbare, nicht gelöschte Zähler / Listen (für Unterabfragen). */
function accessibleMeterIds(ctx: SyncContext) {
    return getDb()
        .select({ id: meters.id })
        .from(meters)
        .where(and(inArray(meters.householdId, ctx.householdIds), isNull(meters.deletedAt)));
}

function accessibleListIds(ctx: SyncContext) {
    return getDb()
        .select({ id: todoLists.id })
        .from(todoLists)
        .where(and(inArray(todoLists.householdId, ctx.householdIds), isNull(todoLists.deletedAt)));
}

async function applyCreate(ctx: SyncContext, op: ParsedSyncOp): Promise<OpResult> {
    const db = getDb();
    const parsed = createSchemas[op.entity].safeParse(op.fields ?? {});
    if (!parsed.success) return rejected(op.opId, "invalid");
    const createdAt = clampCreatedAt(op.createdAt);
    const now = sql`now()`;

    switch (op.entity) {
        case "meter":
        case "list":
        case "note": {
            if (!op.householdId || !ctx.householdIds.includes(op.householdId)) return rejected(op.opId, "no-access");
            const table = op.entity === "meter" ? meters : op.entity === "list" ? todoLists : notes;
            const base = { id: op.id, householdId: op.householdId, createdAt, updatedAt: now };
            const values =
                op.entity === "meter"
                    ? {
                          ...base,
                          ...(parsed.data as z.infer<typeof createSchemas.meter>),
                          name: resolveMeterName((parsed.data as { name?: string }).name, (parsed.data as { type: string }).type),
                      }
                    : op.entity === "note"
                      ? { title: "", ...base, ...(parsed.data as z.infer<typeof createSchemas.note>) }
                      : { ...base, ...(parsed.data as z.infer<typeof createSchemas.list>) };
            const inserted = await db
                .insert(table)
                .values(values as never)
                .onConflictDoNothing({ target: table.id })
                .returning({ id: table.id });
            if (inserted.length) return ok(op.opId);
            const [existing] = await db
                .select({ householdId: table.householdId })
                .from(table)
                .where(eq(table.id, op.id));
            return existing && ctx.householdIds.includes(existing.householdId) ? ok(op.opId) : rejected(op.opId, "conflict");
        }
        case "reading": {
            if (!op.parentId) return rejected(op.opId, "invalid");
            const [parent] = await db
                .select({ id: meters.id })
                .from(meters)
                .where(and(eq(meters.id, op.parentId), inArray(meters.householdId, ctx.householdIds), isNull(meters.deletedAt)))
                .limit(1);
            if (!parent) return rejected(op.opId, "parent-missing");
            const fields = withDates(parsed.data as z.infer<typeof createSchemas.reading>);
            const inserted = await db
                .insert(readings)
                .values({ ...fields, id: op.id, meterId: op.parentId, source: "app", createdAt, updatedAt: now } as never)
                .onConflictDoNothing({ target: readings.id })
                .returning({ id: readings.id });
            if (inserted.length) return ok(op.opId);
            const [existing] = await db.select({ meterId: readings.meterId }).from(readings).where(eq(readings.id, op.id));
            return existing?.meterId === op.parentId ? ok(op.opId) : rejected(op.opId, "conflict");
        }
        case "item": {
            if (!op.parentId) return rejected(op.opId, "invalid");
            const [parent] = await db
                .select({ id: todoLists.id })
                .from(todoLists)
                .where(and(eq(todoLists.id, op.parentId), inArray(todoLists.householdId, ctx.householdIds), isNull(todoLists.deletedAt)))
                .limit(1);
            if (!parent) return rejected(op.opId, "parent-missing");
            const inserted = await db
                .insert(todoItems)
                .values({ ...(parsed.data as z.infer<typeof createSchemas.item>), id: op.id, listId: op.parentId, createdAt, updatedAt: now })
                .onConflictDoNothing({ target: todoItems.id })
                .returning({ id: todoItems.id });
            if (inserted.length) return ok(op.opId);
            const [existing] = await db.select({ listId: todoItems.listId }).from(todoItems).where(eq(todoItems.id, op.id));
            return existing?.listId === op.parentId ? ok(op.opId) : rejected(op.opId, "conflict");
        }
    }
}

function scopeCondition(ctx: SyncContext, entity: ParsedSyncOp["entity"], id: string): SQL {
    switch (entity) {
        case "meter":
            return and(eq(meters.id, id), isNull(meters.deletedAt), inArray(meters.householdId, ctx.householdIds))!;
        case "list":
            return and(eq(todoLists.id, id), isNull(todoLists.deletedAt), inArray(todoLists.householdId, ctx.householdIds))!;
        case "note":
            return and(eq(notes.id, id), isNull(notes.deletedAt), inArray(notes.householdId, ctx.householdIds))!;
        case "reading":
            return and(eq(readings.id, id), isNull(readings.deletedAt), inArray(readings.meterId, accessibleMeterIds(ctx)))!;
        case "item":
            return and(eq(todoItems.id, id), isNull(todoItems.deletedAt), inArray(todoItems.listId, accessibleListIds(ctx)))!;
    }
}

const tables = { meter: meters, reading: readings, list: todoLists, item: todoItems, note: notes } as const;

/** Standardname passend zum (gespeicherten) Typ – in SQL, falls der Typ nicht mitgeschickt wurde */
const defaultNameSql = (type: SQL | string) =>
    sql`case ${type} when 'ELECTRICITY' then 'Strom' when 'GAS' then 'Gas' when 'WATER' then 'Wasser' else 'Zähler' end`;

/**
 * Zählername beim Ändern:
 * - mitgeschickt: übernehmen; leer → Standardname des (neuen oder gespeicherten) Typs
 * - nicht mitgeschickt, aber Typ (ältere App-Versionen schicken ihn bei jedem Speichern): ein
 *   eigener Name bleibt, ein Standardname folgt dem Typ
 */
function meterNameUpdate(fields: Record<string, unknown>): Record<string, unknown> {
    const type = typeof fields.type === "string" ? fields.type : null;
    if (typeof fields.name === "string") {
        const name = fields.name.trim();
        return { ...fields, name: name ? resolveMeterName(name, type ?? "") : type ? resolveMeterName("", type) : defaultNameSql(sql`${meters.type}`) };
    }
    if (type) {
        const standard = sql.join(STANDARD_METER_NAMES.map((n) => sql`${n}`), sql`, `);
        return { ...fields, name: sql`case when ${meters.name} in (${standard}) then ${resolveMeterName("", type)} else ${meters.name} end` };
    }
    return fields;
}

async function applyUpdate(ctx: SyncContext, op: ParsedSyncOp): Promise<OpResult> {
    const parsed = updateSchemas[op.entity].safeParse(op.fields ?? {});
    if (!parsed.success) return rejected(op.opId, "invalid");
    let fields: Record<string, unknown> = op.entity === "reading" ? withDates(parsed.data as { date?: string }) : parsed.data;
    if (op.entity === "meter") fields = meterNameUpdate(fields);
    if (!hasKeys(fields)) return ok(op.opId);
    const table = tables[op.entity];
    const updated = await getDb()
        .update(table)
        .set({ ...fields, updatedAt: sql`now()` } as never)
        .where(scopeCondition(ctx, op.entity, op.id))
        .returning({ id: table.id });
    return updated.length ? ok(op.opId) : rejected(op.opId, "not-found");
}

async function applyDelete(ctx: SyncContext, op: ParsedSyncOp): Promise<OpResult> {
    const db = getDb();
    const table = tables[op.entity];
    const now = sql`now()`;
    const deleted = await db
        .update(table)
        .set({ deletedAt: now, updatedAt: now } as never)
        .where(scopeCondition(ctx, op.entity, op.id))
        .returning({ id: table.id });
    if (deleted.length && op.entity === "meter") {
        await db
            .update(readings)
            .set({ deletedAt: now, updatedAt: now })
            .where(and(eq(readings.meterId, op.id), isNull(readings.deletedAt)));
    }
    if (deleted.length && op.entity === "list") {
        await db
            .update(todoItems)
            .set({ deletedAt: now, updatedAt: now })
            .where(and(eq(todoItems.listId, op.id), isNull(todoItems.deletedAt)));
    }
    // Schon gelöscht oder nie angekommen: Ziel ist erreicht.
    return ok(op.opId);
}

export async function applyOp(ctx: SyncContext, op: ParsedSyncOp): Promise<OpResult> {
    try {
        switch (op.action) {
            case "create":
                return await applyCreate(ctx, op);
            case "update":
                return await applyUpdate(ctx, op);
            case "delete":
                return await applyDelete(ctx, op);
        }
    } catch (error) {
        if (isPermanentDbError(error)) return rejected(op.opId, "invalid");
        throw error;
    }
}

export async function applyOps(ctx: SyncContext, ops: ParsedSyncOp[]): Promise<OpResult[]> {
    const results: OpResult[] = [];
    for (const op of ops) results.push(await applyOp(ctx, op));
    return results;
}

// Pull ----------------------------------------------------------------------------

function columnsWithoutLegacy<T extends Record<string, unknown>>(columns: T) {
    const { legacyId: _legacyId, ...rest } = columns as T & { legacyId?: unknown };
    void _legacyId;
    return rest;
}

const meterColumns = columnsWithoutLegacy(getTableColumns(meters));
const readingColumns = columnsWithoutLegacy(getTableColumns(readings));
const listColumns = columnsWithoutLegacy(getTableColumns(todoLists));
const itemColumns = columnsWithoutLegacy(getTableColumns(todoItems));
const noteColumns = columnsWithoutLegacy(getTableColumns(notes));

type Serialized<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

function serialize<T extends object>(rows: T[]): Serialized<T>[] {
    return rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
        return out as Serialized<T>;
    });
}

export async function pullChanges(ctx: SyncContext, households: Household[], since: Date | null): Promise<SyncChanges> {
    const db = getDb();
    const hids = ctx.householdIds;
    const reset = !since || since.getTime() < Date.now() - FULL_SYNC_AFTER_DAYS * 86_400_000;
    const changed = (t: { updatedAt: AnyPgColumn; deletedAt: AnyPgColumn }) =>
        reset ? isNull(t.deletedAt) : gt(t.updatedAt, since!);

    const [nowResult, meterRows, readingRows, listRows, itemRows, noteRows] = await Promise.all([
        db.execute(sql`select now() as now`) as unknown as Promise<{ rows: { now: string | Date }[] }>,
        db.select(meterColumns).from(meters).where(and(inArray(meters.householdId, hids), changed(meters))),
        db
            .select(readingColumns)
            .from(readings)
            .innerJoin(meters, eq(meters.id, readings.meterId))
            .where(and(inArray(meters.householdId, hids), changed(readings), reset ? isNull(meters.deletedAt) : undefined)),
        db.select(listColumns).from(todoLists).where(and(inArray(todoLists.householdId, hids), changed(todoLists))),
        db
            .select(itemColumns)
            .from(todoItems)
            .innerJoin(todoLists, eq(todoLists.id, todoItems.listId))
            .where(and(inArray(todoLists.householdId, hids), changed(todoItems), reset ? isNull(todoLists.deletedAt) : undefined)),
        db.select(noteColumns).from(notes).where(and(inArray(notes.householdId, hids), changed(notes))),
    ]);

    const dbNow = new Date(nowResult.rows[0].now);
    return {
        reset,
        cursor: new Date(dbNow.getTime() - CURSOR_OVERLAP_MS).toISOString(),
        households,
        meters: serialize(meterRows) as unknown as Meter[],
        readings: serialize(readingRows) as unknown as Reading[],
        lists: serialize(listRows) as unknown as TodoList[],
        items: serialize(itemRows) as unknown as TodoItem[],
        notes: serialize(noteRows) as unknown as Note[],
    };
}
