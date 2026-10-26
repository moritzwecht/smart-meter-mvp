import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { meters, notes, readings, todoItems, todoLists } from "@/lib/db/schema";
import { parseDecimal } from "@/lib/numbers";
import type { ParsedSyncOp } from "@/lib/sync/schemas";
import type { OpResult } from "@/lib/sync/types";
import { getDb } from "./db";
import { logError } from "./log";
import { applyOp, type SyncContext } from "./sync";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * Einmalige Übernahme von Offline-Änderungen aus Version 1
 * ========================================================
 * Die alte App hat Änderungen mit Integer-IDs (positiv = Server, negativ =
 * temporär) in einer lokalen Queue gesammelt – und durch Fehler im alten Sync
 * konnten dort Änderungen hängen bleiben. Nach dem Update schickt der Client diese
 * Queue einmalig hierher; sie wird über `legacy_id` auf die neuen UUIDs übersetzt
 * und mit derselben Logik wie der normale Sync angewendet.
 */

const MIN_TS = Date.UTC(2000, 0, 1);
const MAX_TS = Date.UTC(2100, 0, 1);

export const legacyOpSchema = z.object({
    type: z.enum(["CREATE", "UPDATE", "DELETE"]),
    entity: z.enum(["METER", "READING", "LIST", "ITEM", "NOTE", "HOUSEHOLD"]),
    data: z.record(z.string(), z.unknown()),
    // Unplausible Zeitstempel ignorieren statt die ganze Übertragung abzulehnen
    timestamp: z.number().min(MIN_TS).max(MAX_TS).optional().catch(undefined),
    /** Vom Client vergebene UUID → Wiederholungen legen nichts doppelt an */
    uid: z.uuid().optional().catch(undefined),
});

export type LegacyOp = z.infer<typeof legacyOpSchema>;

const entityMap = { METER: "meter", READING: "reading", LIST: "list", ITEM: "item", NOTE: "note" } as const;
const tables = { meter: meters, reading: readings, list: todoLists, item: todoItems, note: notes } as const;

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? undefined : String(v));
const bool = (v: unknown) => v === true || v === "true";
const num = (v: unknown) => (typeof v === "number" || typeof v === "string" ? parseDecimal(v) : null);

export async function applyLegacyOps(ctx: SyncContext, ops: LegacyOp[]): Promise<{ applied: number; rejected: number }> {
    const db = getDb();
    /** temporäre (negative) IDs aus Version 1 → neue UUIDs */
    const tempIds = new Map<string, string>();
    let applied = 0;
    let rejectedCount = 0;

    async function resolve(entity: keyof typeof tables, legacy: unknown): Promise<string | undefined> {
        // Vom Client bereits übersetzt (temporäre ID → UUID der Anlage)
        if (typeof legacy === "string" && UUID_RE.test(legacy)) return legacy.toLowerCase();
        const n = Number(legacy);
        if (!Number.isInteger(n) || n === 0) return undefined;
        if (n < 0) return tempIds.get(`${entity}:${n}`);
        const table = tables[entity];
        const [row] = await db
            .select({ id: table.id })
            .from(table)
            .where(eq(table.legacyId, n))
            .limit(1);
        return row?.id;
    }

    for (const legacy of ops) {
        if (legacy.entity === "HOUSEHOLD") continue;
        const entity = entityMap[legacy.entity];
        const d = legacy.data;
        let op: ParsedSyncOp | undefined;
        const opId = randomUUID();

        if (legacy.type === "CREATE") {
            const id = legacy.uid ?? randomUUID();
            if (d.tempId !== undefined) tempIds.set(`${entity}:${Number(d.tempId)}`, id);
            const createdAt = legacy.timestamp ? new Date(legacy.timestamp).toISOString() : undefined;
            switch (entity) {
                case "reading": {
                    const parentId = await resolve("meter", d.meterId);
                    const value = num(d.value);
                    const date = d.date ? new Date(String(d.date)) : new Date(legacy.timestamp ?? Date.now());
                    const time = date.getTime();
                    if (parentId && value !== null && time >= MIN_TS && time <= MAX_TS) {
                        op = { opId, entity, action: "create", id, parentId, createdAt, fields: { value, date: date.toISOString(), isReplacement: false } };
                    }
                    break;
                }
                case "item": {
                    const parentId = await resolve("list", d.listId);
                    if (parentId) op = { opId, entity, action: "create", id, parentId, createdAt, fields: { content: str(d.content), completed: false } };
                    break;
                }
                case "note":
                    op = { opId, entity, action: "create", id, householdId: Number(d.householdId), createdAt, fields: { title: str(d.title) ?? "", content: str(d.content) ?? null } };
                    break;
                case "list":
                    op = { opId, entity, action: "create", id, householdId: Number(d.householdId), createdAt, fields: { name: str(d.name) } };
                    break;
                case "meter":
                    op = {
                        opId,
                        entity,
                        action: "create",
                        id,
                        householdId: Number(d.householdId),
                        createdAt,
                        fields: {
                            type: str(d.type),
                            unit: str(d.unit),
                            monthlyPayment: num(d.monthlyPayment),
                            basicFee: num(d.basicFee),
                            pricePerUnit: num(d.pricePerUnit),
                            zNumber: num(d.zNumber),
                            calorificValue: num(d.calorificValue),
                            priceUnit: str(d.priceUnit) ?? null,
                        },
                    };
                    break;
            }
        } else {
            const id = await resolve(entity, d.id);
            if (id && legacy.type === "DELETE") {
                op = { opId, entity, action: "delete", id };
            } else if (id) {
                let fields: Record<string, unknown> | undefined;
                if (d.type === "TOGGLE_PIN") fields = { isPinned: bool(d.isPinned) };
                else if (entity === "note") fields = { title: str(d.title) ?? "", content: str(d.content) ?? null };
                else if (entity === "list") fields = { name: str(d.name) };
                else if (entity === "item") fields = { completed: bool(d.completed) };
                else if (entity === "meter")
                    fields = {
                        type: str(d.type),
                        unit: str(d.unit),
                        monthlyPayment: num(d.monthlyPayment),
                        basicFee: num(d.basicFee),
                        pricePerUnit: num(d.pricePerUnit),
                        zNumber: num(d.zNumber),
                        calorificValue: num(d.calorificValue),
                        priceUnit: str(d.priceUnit) ?? null,
                    };
                if (fields) op = { opId, entity, action: "update", id, fields };
            }
        }

        let result: OpResult;
        try {
            result = op ? await applyOp(ctx, op) : { opId, status: "rejected", reason: "unresolvable" };
        } catch (error) {
            // Ein kaputter Eintrag darf die Übernahme der übrigen nicht verhindern
            logError("legacy-sync", error);
            result = { opId, status: "rejected", reason: "error" };
        }
        if (result.status === "ok") applied++;
        else rejectedCount++;
    }
    return { applied, rejected: rejectedCount };
}
