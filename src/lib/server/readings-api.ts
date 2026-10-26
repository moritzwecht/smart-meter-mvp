import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { households, householdUsers, meters, readings } from "@/lib/db/schema";
import { roundReading } from "@/lib/numbers";
import { getDb } from "./db";

/*
 * Ablesungen von außen (Home Assistant, ESPHome, Skripte).
 * - Höchstens eine Ablesung pro Viertelstunde (feste Zeitfenster :00, :15, :30, :45):
 *   Weitere Werte im selben Fenster aktualisieren die API-Ablesung dieses Fensters.
 *   Ein Zählerwechsel wird dabei nie überschrieben.
 * - Unveränderte Werte werden nicht doppelt gespeichert – außer einmal am Tag
 *   (nach 20 Stunden), damit die Ablese-Erinnerung weiß, dass der Zähler noch meldet.
 * - Schutz vor typischen Sensorfehlern: Ein Wert unter dem letzten Stand (z. B. nach
 *   einem Neustart des Sensors) wird abgelehnt, solange er nicht als Zählerwechsel
 *   markiert ist. Ausnahme: Der letzte Stand war selbst ein Ausreißer nach oben
 *   (Tippfehler in der App), der neue Wert passt zum Stand davor.
 * - Nachträge (mit `date`) dürfen nicht über einer späteren Ablesung liegen.
 * Werte werden wie in der Datenbank auf 4 Nachkommastellen gerundet, bevor verglichen wird.
 */

const WINDOW_MS = 15 * 60_000;
const SAME_VALUE_AGAIN_AFTER_MS = 20 * 3_600_000;

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
        .orderBy(readings.meterId, desc(readings.date), desc(readings.isReplacement), desc(readings.createdAt));
    const byMeter = new Map(latest.map((l) => [l.meterId, l]));
    return rows.map((r) => {
        const l = byMeter.get(r.id);
        return { ...r, lastReading: l ? { value: l.value, date: l.date.toISOString() } : null };
    });
}

export type ApiReadingResult =
    | { status: "created"; id: string }
    | { status: "updated"; id: string }
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
    const value = roundReading(input.value);
    const isReplacement = input.isReplacement ?? false;

    // Die zwei letzten Stände bis zu diesem Zeitpunkt (gleiche Reihenfolge wie in der App)
    const [previous, beforePrevious] = await db
        .select({ id: readings.id, value: readings.value, date: readings.date, source: readings.source, isReplacement: readings.isReplacement })
        .from(readings)
        .where(and(eq(readings.meterId, meter.id), isNull(readings.deletedAt), lte(readings.date, date)))
        .orderBy(desc(readings.date), desc(readings.isReplacement), desc(readings.createdAt))
        .limit(2);

    if (previous && !isReplacement) {
        if (value === previous.value) {
            if (date.getTime() - previous.date.getTime() < SAME_VALUE_AGAIN_AFTER_MS) return { status: "unchanged", id: previous.id };
        } else if (value < previous.value) {
            // War der letzte Stand ein Ausreißer nach oben? Dann passt der neue Wert zum Stand davor.
            const previousIsSpike = !previous.isReplacement && beforePrevious !== undefined && beforePrevious.value <= value;
            if (!previousIsSpike) {
                return {
                    status: "error",
                    httpStatus: 422,
                    error: `Wert ${value} ist kleiner als der letzte Stand ${previous.value}. Bei einem Zählerwechsel "isReplacement": true mitsenden.`,
                };
            }
        }
    }

    if (!isReplacement) {
        const [next] = await db
            .select({ value: readings.value, date: readings.date, isReplacement: readings.isReplacement })
            .from(readings)
            .where(and(eq(readings.meterId, meter.id), isNull(readings.deletedAt), gt(readings.date, date)))
            .orderBy(asc(readings.date), asc(readings.isReplacement), asc(readings.createdAt))
            .limit(1);
        if (next && !next.isReplacement && value > next.value) {
            return {
                status: "error",
                httpStatus: 422,
                error: `Wert ${value} ist größer als die spätere Ablesung ${next.value} vom ${next.date.toISOString()}.`,
            };
        }
    }

    // Zu häufige Automationen (z. B. jede Minute) nicht die Historie fluten lassen:
    // Liegt die letzte API-Ablesung in derselben Viertelstunde, wird sie aktualisiert.
    if (
        previous &&
        !isReplacement &&
        !previous.isReplacement &&
        previous.source === "api" &&
        Math.floor(previous.date.getTime() / WINDOW_MS) === Math.floor(date.getTime() / WINDOW_MS)
    ) {
        await db.update(readings).set({ value, date, updatedAt: sql`now()` }).where(eq(readings.id, previous.id));
        return { status: "updated", id: previous.id };
    }

    const id = randomUUID();
    await db.insert(readings).values({
        id,
        meterId: meter.id,
        value,
        date,
        isReplacement,
        source: "api",
        updatedAt: sql`now()`,
    });
    return { status: "created", id };
}
