import { z } from "zod";

/*
 * Validierung aller Daten, die von außen kommen (Sync, API). Der Server vertraut
 * dem Client nie: Felder, die nicht in der Whitelist stehen, werden verworfen.
 */

const money = z.number().min(0).max(1e9).nullable();
const factor = z.number().positive().max(1e3).nullable();
const isoDate = z.iso.datetime({ offset: true });
const dayDate = z.iso.date();

export const meterTypeSchema = z.enum(["ELECTRICITY", "GAS", "WATER"]);

export const meterFieldsSchema = z.object({
    type: meterTypeSchema,
    unit: z.string().trim().min(1).max(16),
    isPinned: z.boolean(),
    monthlyPayment: money,
    basicFee: money,
    pricePerUnit: z.number().min(0).max(1e5).nullable(),
    priceUnit: z.string().trim().max(16).nullable(),
    zNumber: factor,
    calorificValue: factor,
    billingStart: dayDate.nullable(),
});

export const readingFieldsSchema = z.object({
    value: z.number().min(-1e11).max(1e11),
    date: isoDate,
    isReplacement: z.boolean(),
});

export const listFieldsSchema = z.object({
    name: z.string().trim().min(1).max(200),
    isPinned: z.boolean(),
});

export const itemFieldsSchema = z.object({
    content: z.string().trim().min(1).max(500),
    completed: z.boolean(),
});

export const noteFieldsSchema = z.object({
    title: z.string().max(200),
    content: z.string().max(50_000).nullable(),
    isPinned: z.boolean(),
});

export const fieldSchemas = {
    meter: meterFieldsSchema,
    reading: readingFieldsSchema,
    list: listFieldsSchema,
    item: itemFieldsSchema,
    note: noteFieldsSchema,
} as const;

export const entitySchema = z.enum(["meter", "reading", "list", "item", "note"]);

export const syncOpSchema = z.object({
    opId: z.string().min(1).max(64),
    entity: entitySchema,
    action: z.enum(["create", "update", "delete"]),
    id: z.uuid(),
    householdId: z.number().int().positive().optional(),
    parentId: z.uuid().optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
    createdAt: isoDate.optional(),
});

export const syncRequestSchema = z.object({
    since: isoDate.nullable(),
    ops: z.array(syncOpSchema).max(200),
});

export type ParsedSyncOp = z.infer<typeof syncOpSchema>;

export const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }));

