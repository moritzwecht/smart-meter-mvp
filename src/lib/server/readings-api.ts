import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { households, householdUsers, meters, readings } from "@/lib/db/schema";
import { getDb } from "./db";

/*
 * Ablesungen von außen (Home Assistant, ESPHome, Skripte).
 * Schutz vor typischen Sensorfehlern: Ein Wert unter dem letzten Stand (z. B.
 * nach einem Neustart des Sensors) wird abgelehnt, solange er nicht ausdrücklich
 * als Zählerwechsel markiert ist. Unveränderte Werte werden nicht doppelt gespeichert.
 */

export async function listMetersForUser(userId: number) {
    const db = getDb();
    const rows = await db
        .select({
            id: meters.id,
            type: meters.type,
            name: meters.name,
            unit: meters.unit,
            householdId: households.id,
            household: households.name,
        })
        .from(meters)
        .innerJoin(households, eq(households.id, meters.householdId))
        .innerJoin(householdUsers, and(eq(householdUsers.householdId, households.id), eq(householdUsers.userId, userId)))
        .where(isNull(meters.deletedAt))
        .orderBy(households.name, meters.createdAt);
    if (!rows.length) return [];
    const latest = await db
        .selectDistinctOn([readings.meterId], { meterId: readings.meterId, value: readings.value, date: readings.date })
        .from(readings)
        .where(and(inArray(readings.meterId, rows.map((r) => r.id)), isNull(readings.deletedAt)))
        .orderBy(readings.meterId, desc(readings.date));
    const byMeter = new Map(latest.map((l) => [l.meterId, l]));
    return rows.map((r) => {
        const l = byMeter.get(r.id);
        return { ...r, lastReading: l ? { value: l.value, date: l.date.toISOString() } : null };
    });
}

export type ApiReadingResult =
    | { status: "created"; id: string }
    | { status: "unchanged"; id: string }
    | { status: "error"; httpStatus: number; error: string };

export async function createReadingFromApi(
    userId: number,
    input: { meterId: string; value: number; date?: string; isReplacement?: boolean },
): Promise<ApiReadingResult> {
    const db = getDb();
    const [meter] = await db
        .select({ id: meters.id })
        .from(meters)
        .innerJoin(householdUsers, and(eq(householdUsers.householdId, meters.householdId), eq(householdUsers.userId, userId)))
        .where(and(eq(meters.id, input.meterId), isNull(meters.deletedAt)));
    if (!meter) return { status: "error", httpStatus: 404, error: "Zähler nicht gefunden oder kein Zugriff." };

    const date = input.date ? new Date(input.date) : new Date();
    if (date.getTime() > Date.now() + 5 * 60_000) return { status: "error", httpStatus: 422, error: "Datum liegt in der Zukunft." };

    const [previous] = await db
        .select({ id: readings.id, value: readings.value })
        .from(readings)
        .where(and(eq(readings.meterId, meter.id), isNull(readings.deletedAt), lte(readings.date, date)))
        .orderBy(desc(readings.date))
        .limit(1);

    if (previous && !input.isReplacement) {
        if (input.value === previous.value) return { status: "unchanged", id: previous.id };
        if (input.value < previous.value) {
            return {
                status: "error",
                httpStatus: 422,
                error: `Wert ${input.value} ist kleiner als der letzte Stand ${previous.value}. Bei einem Zählerwechsel "isReplacement": true mitsenden.`,
            };
        }
    }

    const id = randomUUID();
    await db.insert(readings).values({
        id,
        meterId: meter.id,
        value: input.value,
        date,
        isReplacement: input.isReplacement ?? false,
        source: "api",
        updatedAt: sql`now()`,
    });
    return { status: "created", id };
}
