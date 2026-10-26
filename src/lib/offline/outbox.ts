import { db, type OutboxEntry } from "./db";
import type { SyncOp } from "@/lib/sync/types";

/*
 * Outbox mit Zusammenführung
 * --------------------------
 * Jede lokale Änderung wird als Operation vorgemerkt. Noch nicht gesendete
 * Operationen für denselben Datensatz werden zusammengeführt:
 *   create + update  → ein create mit den neuesten Feldern
 *   update + update  → ein update
 *   create + delete  → nichts (der Datensatz hat den Server nie erreicht)
 * So schickt z. B. das Autosave einer Notiz nicht hunderte Updates.
 *
 * Muss innerhalb einer Dexie-Transaktion aufgerufen werden, die `db.outbox` enthält.
 */
export async function enqueue(op: SyncOp): Promise<void> {
    const pending = (await db.outbox.where("entityId").equals(op.id).toArray()).filter((e) => e.sending === 0);

    if (op.action === "update") {
        const target = pending.find((e) => e.op.action === "create") ?? pending.find((e) => e.op.action === "update");
        if (target && "fields" in target.op) {
            const merged = { ...target.op, fields: { ...target.op.fields, ...op.fields } } as SyncOp;
            await db.outbox.update(target.seq!, { op: merged });
            return;
        }
    }

    if (op.action === "delete") {
        const pendingCreate = pending.find((e) => e.op.action === "create");
        // Ausstehende Kind-Operationen (z. B. Punkte einer gelöschten Liste) sind überflüssig
        const children = (await db.outbox.toArray()).filter(
            (e) => e.sending === 0 && e.op.action === "create" && e.op.parentId === op.id,
        );
        const childIds = new Set(children.map((c) => c.entityId));
        const childOps = childIds.size
            ? (await db.outbox.where("entityId").anyOf([...childIds]).toArray()).filter((e) => e.sending === 0)
            : [];
        await db.outbox.bulkDelete([...pending, ...childOps].map((e) => e.seq!));
        if (pendingCreate) return; // nie beim Server angekommen → nichts zu löschen
    }

    const entry: OutboxEntry = { entityId: op.id, op, sending: 0, queuedAt: Date.now() };
    await db.outbox.add(entry);
}
