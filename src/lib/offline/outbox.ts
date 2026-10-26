import { db, type OutboxEntry } from "./db";
import type { SyncOp } from "@/lib/sync/types";

/*
 * Outbox mit Zusammenführung
 * --------------------------
 * Jede lokale Änderung wird als Operation vorgemerkt. Die jeweils *letzte*
 * Operation eines Datensatzes wird mit neuen Änderungen zusammengeführt, solange
 * sie noch nie gesendet wurde:
 *   create + update  → ein create mit den neuesten Feldern
 *   update + update  → ein update
 *   create + delete  → nichts (der Datensatz hat den Server nie erreicht)
 * So schickt z. B. das Autosave einer Notiz nicht hunderte Updates.
 *
 * Eine schon einmal gesendete Operation (`attempted`) bleibt unverändert: Kam nur
 * die Antwort nicht an, hat der Server sie evtl. schon angewendet. Spätere
 * Änderungen werden deshalb angehängt – sonst gingen sie beim idempotenten
 * Wiederholen verloren oder ein älterer Stand würde einen neueren überschreiben.
 *
 * Muss innerhalb einer Dexie-Transaktion aufgerufen werden, die `db.outbox` enthält.
 */

const mergeable = (e: OutboxEntry) => e.sending === 0 && !e.attempted;

export async function enqueue(op: SyncOp): Promise<void> {
    const forEntity = await db.outbox.where("entityId").equals(op.id).sortBy("seq");

    if (op.action === "update") {
        const last = forEntity[forEntity.length - 1];
        if (last && mergeable(last) && (last.op.action === "create" || last.op.action === "update")) {
            const merged = { ...last.op, fields: { ...last.op.fields, ...op.fields } } as SyncOp;
            await db.outbox.update(last.seq!, { op: merged });
            return;
        }
    }

    if (op.action === "delete") {
        const removable = forEntity.filter(mergeable);
        const inFlightOrSent = forEntity.filter((e) => !mergeable(e));
        // Ausstehende Kind-Operationen (z. B. Punkte einer gelöschten Liste) sind überflüssig
        const childIds = new Set(
            (await db.outbox.toArray())
                .filter((e) => mergeable(e) && e.op.action === "create" && e.op.parentId === op.id)
                .map((e) => e.entityId),
        );
        const childOps = childIds.size ? (await db.outbox.where("entityId").anyOf([...childIds]).toArray()).filter(mergeable) : [];
        await db.outbox.bulkDelete([...removable, ...childOps].map((e) => e.seq!));
        // Nie beim Server angekommen → nichts zu löschen
        if (removable.some((e) => e.op.action === "create") && inFlightOrSent.length === 0) return;
    }

    const entry: OutboxEntry = { entityId: op.id, op, sending: 0, attempted: 0, queuedAt: Date.now() };
    await db.outbox.add(entry);
}
