import "server-only";
import { and, eq, isNotNull, isNull, lt, max, sql } from "drizzle-orm";
import { householdUsers, meters, notes, readings, todoItems, todoLists, users } from "@/lib/db/schema";
import { purgeExpiredTokens } from "./auth-tokens";
import { getDb } from "./db";
import { sendPushToUser } from "./push";
import { purgeOldAttempts } from "./rate-limit";
import { meterShortName } from "@/lib/meter/names";
import { FULL_SYNC_AFTER_DAYS } from "./sync";


/** Tag im Monat in deutscher Zeit (Cron läuft in UTC). */
export function berlinDayOfMonth(now = new Date()): number {
    return Number(new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: "Europe/Berlin" }).format(now));
}

/**
 * Ablese-Erinnerung: Nutzer, deren Erinnerungstag heute ist, bekommen eine Push-
 * Nachricht – aber nur, wenn mindestens ein Zähler seit 5 Tagen keinen Stand hat.
 */
export async function sendReadingReminders(now = new Date()) {
    const db = getDb();
    const today = berlinDayOfMonth(now);
    const due = await db
        .select({ id: users.id })
        .from(users)
        .where(and(isNotNull(users.reminderDay), eq(users.reminderDay, today)));

    let notified = 0;
    for (const user of due) {
        const staleSince = new Date(now.getTime() - 5 * 86_400_000);
        const meterRows = await db
            .select({ id: meters.id, type: meters.type, name: meters.name, last: max(readings.date) })
            .from(meters)
            .innerJoin(householdUsers, and(eq(householdUsers.householdId, meters.householdId), eq(householdUsers.userId, user.id)))
            .leftJoin(readings, and(eq(readings.meterId, meters.id), isNull(readings.deletedAt)))
            .where(isNull(meters.deletedAt))
            .groupBy(meters.id, meters.type, meters.name);
        const stale = meterRows.filter((m) => !m.last || new Date(m.last) < staleSince);
        if (!stale.length) continue;
        const names = [...new Set(stale.map((m) => meterShortName(m)))].join(", ");
        const result = await sendPushToUser(user.id, {
            title: "Zeit zum Ablesen 📟",
            body: `${names} ${stale.length === 1 ? "wartet" : "warten"} auf einen neuen Stand.`,
            url: "/?tab=meters",
            tag: "reading-reminder",
        });
        if (result.sent) notified++;
    }
    return { due: due.length, notified };
}

/** Räumt alte Löschmarkierungen, Login-Versuche und Tokens auf. */
export async function cleanup() {
    const db = getDb();
    // Tombstones werden nur gebraucht, bis jeder Client sie per Delta-Sync gesehen hat.
    // Wer länger als FULL_SYNC_AFTER_DAYS offline war, bekommt ohnehin den vollen Bestand.
    const cutoff = sql`now() - make_interval(days => ${FULL_SYNC_AFTER_DAYS + 30})`;
    const purged = { readings: 0, items: 0, meters: 0, lists: 0, notes: 0 };
    purged.readings = (await db.delete(readings).where(lt(readings.deletedAt, cutoff)).returning({ id: readings.id })).length;
    purged.items = (await db.delete(todoItems).where(lt(todoItems.deletedAt, cutoff)).returning({ id: todoItems.id })).length;
    // Gelöschte Zähler/Listen: ihre Kinder sind mit gelöscht worden, die Kaskade räumt sie mit ab
    purged.meters = (await db.delete(meters).where(lt(meters.deletedAt, cutoff)).returning({ id: meters.id })).length;
    purged.lists = (await db.delete(todoLists).where(lt(todoLists.deletedAt, cutoff)).returning({ id: todoLists.id })).length;
    purged.notes = (await db.delete(notes).where(lt(notes.deletedAt, cutoff)).returning({ id: notes.id })).length;
    await purgeOldAttempts();
    await purgeExpiredTokens();
    return purged;
}

