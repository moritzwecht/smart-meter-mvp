import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { applyLegacyOps } from "@/lib/server/legacy-sync";
import { applyOps, pullChanges, type SyncContext } from "@/lib/server/sync";
import type { ParsedSyncOp } from "@/lib/sync/schemas";
import type { Household } from "@/lib/sync/types";
import { setupServer, type TestServer } from "../support/server";

let server: TestServer;
let moritz: SyncContext;
let fremd: SyncContext;
let hh: Household[];

const op = (o: Omit<ParsedSyncOp, "opId">): ParsedSyncOp => ({ opId: randomUUID(), ...o }) as ParsedSyncOp;

beforeEach(async () => {
    server = await setupServer();
    moritz = { userId: server.users.moritz.id, householdIds: [server.households.zuhause.id] };
    fremd = { userId: server.users.fremd.id, householdIds: [server.households.fremd.id] };
    hh = [{ id: server.households.zuhause.id, name: "Zuhause", role: "OWNER" }];
});

describe("Sync-Push", () => {
    it("legt Datensätze idempotent an (doppelt senden erzeugt keine Dubletten)", async () => {
        const listId = randomUUID();
        const create = op({ entity: "list", action: "create", id: listId, householdId: server.households.zuhause.id, fields: { name: "Einkauf" } });
        expect(await applyOps(moritz, [create])).toEqual([{ opId: create.opId, status: "ok" }]);
        expect(await applyOps(moritz, [create])).toEqual([{ opId: create.opId, status: "ok" }]);
        expect(await server.count("todo_lists")).toBe(1);
    });

    it("verarbeitet Eltern und Kinder in einem Batch", async () => {
        const meterId = randomUUID();
        const results = await applyOps(moritz, [
            op({ entity: "meter", action: "create", id: meterId, householdId: server.households.zuhause.id, fields: { type: "GAS", unit: "m³", pricePerUnit: 0.12, priceUnit: "kwh" } }),
            op({ entity: "reading", action: "create", id: randomUUID(), parentId: meterId, fields: { value: 1234.5, date: "2026-01-01T08:00:00.000Z", isReplacement: false } }),
        ]);
        expect(results.every((r) => r.status === "ok")).toBe(true);
        const [m] = (await server.client.query<{ name: string; price_per_unit: string }>("select name, price_per_unit from meters")).rows;
        expect(m.name).toBe("Gas");
        expect(Number(m.price_per_unit)).toBe(0.12);
    });

    it("lehnt Zugriffe auf fremde Haushalte ab – ohne die übrigen Operationen zu blockieren", async () => {
        const fremdeListe = randomUUID();
        await applyOps(fremd, [op({ entity: "list", action: "create", id: fremdeListe, householdId: server.households.fremd.id, fields: { name: "Geheim" } })]);

        const results = await applyOps(moritz, [
            op({ entity: "list", action: "update", id: fremdeListe, fields: { name: "gehackt" } }),
            op({ entity: "item", action: "create", id: randomUUID(), parentId: fremdeListe, fields: { content: "x" } }),
            op({ entity: "note", action: "create", id: randomUUID(), householdId: server.households.fremd.id, fields: { title: "x" } }),
            op({ entity: "list", action: "delete", id: fremdeListe }),
            op({ entity: "note", action: "create", id: randomUUID(), householdId: server.households.zuhause.id, fields: { title: "Meins" } }),
        ]);
        expect(results.map((r) => r.status)).toEqual(["rejected", "rejected", "rejected", "ok", "ok"]);
        const [liste] = (await server.client.query<{ name: string; deleted_at: Date | null }>("select name, deleted_at from todo_lists")).rows;
        expect(liste).toEqual({ name: "Geheim", deleted_at: null }); // unverändert
    });

    it("lehnt ungültige Daten ab und ignoriert unbekannte Felder", async () => {
        const id = randomUUID();
        const results = await applyOps(moritz, [
            op({ entity: "meter", action: "create", id: randomUUID(), householdId: server.households.zuhause.id, fields: { type: "NUCLEAR", unit: "kWh" } }),
            op({ entity: "note", action: "create", id, householdId: server.households.zuhause.id, fields: { title: "ok", householdId: 999, isAdmin: true } as never }),
            op({ entity: "note", action: "update", id, fields: { title: "x".repeat(1000) } }),
        ]);
        expect(results.map((r) => r.status)).toEqual(["rejected", "ok", "rejected"]);
        const [note] = (await server.client.query<{ household_id: number }>("select household_id from notes")).rows;
        expect(note.household_id).toBe(server.households.zuhause.id);
    });

    it("Updates auf gelöschte Datensätze werden abgelehnt, Löschungen sind idempotent", async () => {
        const id = randomUUID();
        await applyOps(moritz, [op({ entity: "note", action: "create", id, householdId: server.households.zuhause.id, fields: { title: "A" } })]);
        const results = await applyOps(moritz, [
            op({ entity: "note", action: "delete", id }),
            op({ entity: "note", action: "update", id, fields: { title: "verspätetes Autosave" } }),
            op({ entity: "note", action: "delete", id }),
        ]);
        expect(results.map((r) => r.status)).toEqual(["ok", "rejected", "ok"]);
    });

    it("Löschen eines Zählers löscht seine Ablesungen mit (als Tombstones)", async () => {
        const meterId = randomUUID();
        await applyOps(moritz, [
            op({ entity: "meter", action: "create", id: meterId, householdId: server.households.zuhause.id, fields: { type: "WATER", unit: "m³" } }),
            op({ entity: "reading", action: "create", id: randomUUID(), parentId: meterId, fields: { value: 1, date: "2026-01-01T00:00:00Z" } }),
        ]);
        await applyOps(moritz, [op({ entity: "meter", action: "delete", id: meterId })]);
        expect(await server.count("readings", "deleted_at is not null")).toBe(1);
    });
});

describe("Sync-Pull", () => {
    it("liefert beim ersten Mal den vollen Bestand, danach nur Änderungen inkl. Löschungen", async () => {
        const a = randomUUID();
        const b = randomUUID();
        await applyOps(moritz, [
            op({ entity: "note", action: "create", id: a, householdId: server.households.zuhause.id, fields: { title: "A" } }),
            op({ entity: "note", action: "create", id: b, householdId: server.households.zuhause.id, fields: { title: "B" } }),
        ]);
        const full = await pullChanges(moritz, hh, null);
        expect(full.reset).toBe(true);
        expect(full.notes.map((n) => n.title).sort()).toEqual(["A", "B"]);

        // Cursor liegt etwas in der Vergangenheit (Überlappung) → für ein sauberes Delta "jetzt" nehmen
        const since = new Date((await server.now()).getTime() + 1);
        await new Promise((r) => setTimeout(r, 5));
        await applyOps(moritz, [op({ entity: "note", action: "update", id: a, fields: { title: "A2" } }), op({ entity: "note", action: "delete", id: b })]);
        const delta = await pullChanges(moritz, hh, since);
        expect(delta.reset).toBe(false);
        const byId = Object.fromEntries(delta.notes.map((n) => [n.id, n]));
        expect(byId[a].title).toBe("A2");
        expect(byId[b].deletedAt).toBeTruthy();
    });

    it("liefert nur Daten aus den eigenen Haushalten, ohne interne Felder", async () => {
        await applyOps(fremd, [op({ entity: "note", action: "create", id: randomUUID(), householdId: server.households.fremd.id, fields: { title: "Fremd" } })]);
        await applyOps(moritz, [op({ entity: "note", action: "create", id: randomUUID(), householdId: server.households.zuhause.id, fields: { title: "Meins" } })]);
        const res = await pullChanges(moritz, hh, null);
        expect(res.notes.map((n) => n.title)).toEqual(["Meins"]);
        expect(res.notes[0]).not.toHaveProperty("legacyId");
        expect(typeof res.notes[0].createdAt).toBe("string");
    });

    it("funktioniert auch ohne Haushalte", async () => {
        const res = await pullChanges({ userId: 99, householdIds: [] }, [], null);
        expect(res.meters).toEqual([]);
        expect(res.notes).toEqual([]);
    });
});

describe("Übernahme alter Offline-Änderungen (Version 1)", () => {
    it("übersetzt alte IDs und temporäre IDs", async () => {
        // Bestehende Daten mit legacy_id (wie nach der Migration)
        const listId = randomUUID();
        await server.client.query(
            `insert into todo_lists (id, household_id, name, legacy_id) values ($1, $2, 'Einkauf', 200)`,
            [listId, server.households.zuhause.id],
        );
        await server.client.query(`insert into todo_items (id, list_id, content, legacy_id) values ($1, $2, 'Milch', 300)`, [randomUUID(), listId]);
        const meterId = randomUUID();
        await server.client.query(`insert into meters (id, household_id, name, type, unit, legacy_id) values ($1, $2, 'Strom', 'ELECTRICITY', 'kWh', 100)`, [
            meterId,
            server.households.zuhause.id,
        ]);

        const result = await applyLegacyOps(moritz, [
            { type: "UPDATE", entity: "ITEM", data: { id: 300, completed: "true" } },
            { type: "CREATE", entity: "ITEM", data: { listId: 200, content: "Brot", tempId: -5 } },
            { type: "CREATE", entity: "READING", data: { meterId: 100, value: "12.345,6", date: "2026-01-20T10:00:00.000Z", tempId: -7 } },
            { type: "CREATE", entity: "NOTE", data: { householdId: server.households.zuhause.id, title: "Neu", content: "x", tempId: -9 } },
            { type: "UPDATE", entity: "NOTE", data: { id: -9, isPinned: "true", type: "TOGGLE_PIN" } },
            { type: "UPDATE", entity: "METER", data: { id: 100, isPinned: "true", type: "TOGGLE_PIN" } },
            { type: "DELETE", entity: "NOTE", data: { id: 4711 } }, // existiert nicht → abgelehnt, blockiert nichts
        ]);
        expect(result).toEqual({ applied: 6, rejected: 1 });
        expect((await server.client.query<{ completed: boolean }>(`select completed from todo_items where legacy_id = 300`)).rows[0].completed).toBe(true);
        expect(await server.count("todo_items")).toBe(2);
        expect(Number((await server.client.query<{ value: string }>(`select value from readings`)).rows[0].value)).toBe(12345.6);
        expect((await server.client.query<{ is_pinned: boolean }>(`select is_pinned from notes`)).rows[0].is_pinned).toBe(true);
        expect((await server.client.query<{ is_pinned: boolean }>(`select is_pinned from meters`)).rows[0].is_pinned).toBe(true);
    });
});
