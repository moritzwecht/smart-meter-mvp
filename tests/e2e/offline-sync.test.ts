/**
 * Ende-zu-Ende-Tests des Offline-Syncs: echte Client-Engine (Dexie auf
 * fake-indexeddb) ↔ echter Route Handler /api/sync ↔ echte Datenbank (PGlite).
 * Jedes "Gerät" hat seine eigene IndexedDB.
 */
import "fake-indexeddb/auto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { householdUsers, households } from "@/lib/db/schema";
import { setupServer, type TestServer } from "../support/server";

let activeUserId: number | null = null;
let failNextRequests = 0;
/** Server wendet an, aber die Antwort geht verloren (Verbindungsabbruch). */
let dropNextResponses = 0;
/** Hält Requests an, bis das Promise erfüllt ist (für "während eines laufenden Syncs"). */
let gate: Promise<void> | null = null;
/** Hält die (schon berechnete) Antwort zurück. */
let responseGate: Promise<void> | null = null;
let offline = false;

vi.mock("@/lib/server/session", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/server/session")>();
    return {
        ...original,
        getCurrentUser: async () =>
            activeUserId === null ? null : { id: activeUserId, email: "", name: "", hasPassword: true, sessionVersion: 0 },
    };
});

// Route Handler einmal importieren – bleibt über alle "Geräte" hinweg derselbe Server
const routes = {
    sync: await import("@/app/api/sync/route"),
    legacy: await import("@/app/api/sync/legacy/route"),
};

globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (gate) await gate;
    if (offline) throw new TypeError("Failed to fetch");
    if (failNextRequests > 0) {
        failNextRequests--;
        return new Response("boom", { status: 500 });
    }
    const url = String(input);
    const request = new Request(`http://localhost${url}`, { ...init, signal: undefined });
    let res: Response;
    if (url === "/api/sync") res = await routes.sync.POST(request);
    else if (url === "/api/sync/legacy") res = await routes.legacy.POST(request);
    else res = new Response("not found", { status: 404 });
    if (responseGate) await responseGate;
    if (dropNextResponses > 0) {
        dropNextResponses--;
        throw new TypeError("The network connection was lost.");
    }
    return res;
}) as typeof fetch;

type Device = Awaited<ReturnType<typeof createDevice>>;

/** Ein Gerät = eigene IndexedDB + eigene Instanz von Repo/Engine (gleiche `factory` = zweiter Tab). */
async function createDevice(userId: number, factory = new IDBFactory()) {
    vi.resetModules();
    globalThis.indexedDB = factory;
    globalThis.IDBKeyRange = IDBKeyRange;
    const offlineDb = await import("@/lib/offline/db");
    const repo = await import("@/lib/offline/repo");
    const engine = await import("@/lib/offline/sync-engine");
    return {
        factory,
        db: offlineDb.db,
        repo,
        engine,
        async sync() {
            activeUserId = userId;
            await engine.runSync();
            activeUserId = null;
            return engine.getSyncState();
        },
        outbox: () => offlineDb.db.outbox.toArray(),
    };
}

let server: TestServer;
let householdId: number;
let phone: Device;
let laptop: Device;
let annasPhone: Device;

beforeEach(async () => {
    server = await setupServer();
    householdId = server.households.zuhause.id;
    offline = false;
    failNextRequests = 0;
    dropNextResponses = 0;
    gate = null;
    responseGate = null;
    phone = await createDevice(server.users.moritz.id);
    laptop = await createDevice(server.users.moritz.id);
    annasPhone = await createDevice(server.users.anna.id);
    await phone.sync();
    await laptop.sync();
    await annasPhone.sync();
});

afterEach(() => {
    vi.clearAllTimers();
});

describe("Offline-Sync", () => {
    it("holt nach dem ersten Sync die Haushalte", async () => {
        expect(await phone.db.households.toArray()).toEqual([{ id: householdId, name: "Zuhause", role: "OWNER" }]);
        expect(await annasPhone.db.households.toArray()).toEqual([{ id: householdId, name: "Zuhause", role: "MEMBER" }]);
    });

    it("überträgt offline erfasste Änderungen vollständig, sobald wieder Netz da ist", async () => {
        offline = true;
        const listId = await phone.repo.addList(householdId, "Einkauf");
        for (const item of ["Milch", "Brot", "Eier"]) await phone.repo.addItem(listId, item);
        const noteId = await phone.repo.addNote(householdId, { title: "WLAN" });
        await phone.repo.updateNote(noteId, { content: "geheim" });
        expect((await phone.sync()).status).toBe("offline");
        expect((await phone.outbox()).length).toBe(5); // Notiz-Update in das Create gefaltet

        offline = false;
        expect((await phone.sync()).status).toBe("idle");
        expect(await phone.outbox()).toEqual([]);
        expect(await server.count("todo_items")).toBe(3);

        await laptop.sync();
        const items = await laptop.db.todoItems.toArray();
        expect(items.map((i) => i.content).sort()).toEqual(["Brot", "Eier", "Milch"]);
        expect((await laptop.db.notes.get(noteId))?.content).toBe("geheim");
    });

    it("schnelle Änderungen während eines laufenden Syncs gehen nicht verloren", async () => {
        const listId = await phone.repo.addList(householdId, "Einkauf");
        const ids = [];
        for (let i = 0; i < 5; i++) ids.push(await phone.repo.addItem(listId, `Punkt ${i}`));
        await phone.sync();

        // Fünf Häkchen, während der Sync schon läuft
        const running = phone.sync();
        for (const id of ids) await phone.repo.updateItem(id, { completed: true });
        await running;
        await phone.sync();

        expect(await phone.outbox()).toEqual([]);
        expect(await server.count("todo_items", "completed")).toBe(5);
    });

    it("eine abgelehnte Änderung blockiert die Queue nicht (Version 1: Sync stand danach komplett)", async () => {
        const noteId = await phone.repo.addNote(householdId, { title: "Temp" });
        await phone.sync();

        // Notiz wird auf dem Laptop gelöscht, während das Handy offline weiter tippt
        await laptop.sync();
        await laptop.repo.deleteNote(noteId);
        await laptop.sync();

        offline = true;
        await phone.repo.updateNote(noteId, { content: "noch getippt" });
        const otherNote = await phone.repo.addNote(householdId, { title: "Wichtig" });
        offline = false;
        await phone.sync();

        expect(await phone.outbox()).toEqual([]);
        expect(await server.count("notes", `id = '${otherNote}'`)).toBe(1);
        // Die gelöschte Notiz verschwindet auch auf dem Handy
        expect(await phone.db.notes.get(noteId)).toBeUndefined();
    });

    it("Abhaken in einer Liste, die jemand anderes gelöscht hat, räumt sauber auf", async () => {
        const listId = await phone.repo.addList(householdId, "Baumarkt");
        const itemId = await phone.repo.addItem(listId, "Schrauben");
        await phone.sync();
        await annasPhone.sync();

        offline = true;
        await phone.repo.updateItem(itemId, { completed: true });
        offline = false;
        await annasPhone.repo.deleteList(listId);
        await annasPhone.sync();

        await phone.sync();
        expect(await phone.outbox()).toEqual([]);
        expect(await phone.db.todoLists.get(listId)).toBeUndefined();
        expect(await phone.db.todoItems.get(itemId)).toBeUndefined();
    });

    it("ausstehende lokale Änderungen werden vom Pull nicht überschrieben", async () => {
        const listId = await phone.repo.addList(householdId, "Einkauf");
        const itemId = await phone.repo.addItem(listId, "Milch");
        await phone.sync();
        await laptop.sync();

        await laptop.repo.updateItem(itemId, { content: "Hafermilch" });
        await laptop.sync();

        // Handy: Haken setzen, Server schlägt einmal fehl → Änderung bleibt lokal sichtbar
        await phone.repo.updateItem(itemId, { completed: true });
        failNextRequests = 1;
        expect((await phone.sync()).status).toBe("error");
        expect((await phone.db.todoItems.get(itemId))?.completed).toBe(true);
        expect((await phone.outbox()).length).toBe(1);

        await phone.sync();
        const item = await phone.db.todoItems.get(itemId);
        expect(item).toMatchObject({ completed: true, content: "Hafermilch" });
        expect(await server.count("todo_items", "completed")).toBe(1);
    });

    it("nach einem Serverfehler wird erneut gesendet – ohne Dubletten", async () => {
        const meterId = await phone.repo.addMeter(householdId, { type: "ELECTRICITY", unit: "kWh" });
        await phone.repo.addReading(meterId, { value: 100, date: new Date().toISOString(), isReplacement: false });
        failNextRequests = 1;
        await phone.sync();
        await phone.sync();
        await phone.sync(); // nochmal, schadet nicht
        expect(await server.count("meters")).toBe(1);
        expect(await server.count("readings")).toBe(1);
    });

    it("anlegen und wieder löschen, bevor es gesendet wurde, erzeugt gar keinen Request-Inhalt", async () => {
        offline = true;
        const listId = await phone.repo.addList(householdId, "Kurz");
        await phone.repo.addItem(listId, "x");
        await phone.repo.deleteList(listId);
        expect(await phone.outbox()).toEqual([]);
    });

    it("Autosave erzeugt nur eine Operation pro Notiz", async () => {
        const noteId = await phone.repo.addNote(householdId, { title: "" });
        await phone.sync();
        offline = true;
        for (let i = 1; i <= 20; i++) await phone.repo.updateNote(noteId, { content: "x".repeat(i) });
        expect((await phone.outbox()).length).toBe(1);
    });

    it("entfernt Daten eines Haushalts, aus dem man entfernt wurde", async () => {
        await annasPhone.repo.addNote(householdId, { title: "Annas Notiz" });
        await annasPhone.sync();
        expect(await annasPhone.db.notes.count()).toBe(1);
        await server.client.query(`delete from household_users where user_id = $1`, [server.users.anna.id]);
        await annasPhone.sync();
        expect(await annasPhone.db.households.count()).toBe(0);
        expect(await annasPhone.db.notes.count()).toBe(0);
    });

    it("lädt nach dem Beitritt zu einem Haushalt dessen vollständige Daten", async () => {
        const fremd = await createDevice(server.users.fremd.id);
        await fremd.sync();
        await phone.repo.addNote(householdId, { title: "Alt" });
        await phone.sync();
        await fremd.sync();
        await server.client.query(`insert into household_users (household_id, user_id, role) values ($1, $2, 'MEMBER')`, [householdId, server.users.fremd.id]);
        await fremd.sync();
        expect((await fremd.db.notes.toArray()).map((n) => n.title)).toEqual(["Alt"]);
    });
});

const serverNote = async (id: string) =>
    (await server.client.query<{ content: string | null; deleted_at: Date | null }>(`select content, deleted_at from notes where id = $1`, [id])).rows[0];

function hold() {
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    return () => {
        gate = null;
        release();
    };
}

describe("Robustheit bei Verbindungsabbrüchen", () => {
    it("Antwort verloren nach dem Anlegen: spätere Änderung kommt trotzdem an", async () => {
        const noteId = await phone.repo.addNote(householdId, { title: "n" });
        dropNextResponses = 1;
        await phone.sync(); // Server hat angelegt, Client weiß es nicht
        await phone.repo.updateNote(noteId, { content: "wichtig" });
        await phone.sync();
        expect((await serverNote(noteId)).content).toBe("wichtig");
        expect((await phone.db.notes.get(noteId))?.content).toBe("wichtig");
    });

    it("Antwort verloren nach dem Anlegen: Löschen wird trotzdem übertragen", async () => {
        const noteId = await phone.repo.addNote(householdId, { title: "weg" });
        dropNextResponses = 1;
        await phone.sync();
        await phone.repo.deleteNote(noteId);
        await phone.sync();
        expect(await phone.db.notes.get(noteId)).toBeUndefined();
        expect((await serverNote(noteId)).deleted_at).not.toBeNull();
    });

    it("nach einem Fehler gewinnt immer die letzte Eingabe", async () => {
        const noteId = await phone.repo.addNote(householdId, { title: "n" });
        await phone.sync();
        await phone.repo.updateNote(noteId, { content: "a" });
        const release = hold();
        failNextRequests = 1;
        const running = phone.sync();
        await new Promise((r) => setTimeout(r, 20));
        await phone.repo.updateNote(noteId, { content: "ab" });
        release();
        await running;
        await phone.repo.updateNote(noteId, { content: "abc" });
        await phone.sync();
        expect((await serverNote(noteId)).content).toBe("abc");
        expect((await phone.db.notes.get(noteId))?.content).toBe("abc");
    });

    it("ein zweiter Tab stört einen laufenden Sync nicht", async () => {
        const noteId = await phone.repo.addNote(householdId, { title: "n" });
        await phone.sync();
        await phone.repo.updateNote(noteId, { content: "a" });
        const release = hold();
        const running = phone.sync();
        await new Promise((r) => setTimeout(r, 20));
        // Zweiter Tab (gleiche IndexedDB) setzt beim Start nur nicht laufende Operationen zurück
        const tab = await createDevice(server.users.moritz.id, phone.factory);
        await tab.repo.updateNote(noteId, { content: "ab" });
        release();
        await running;
        await phone.sync();
        expect((await serverNote(noteId)).content).toBe("ab");
    });

    it("Vollabgleich nach Haushaltsbeitritt wird auch nach Abbruch + Neustart nachgeholt", async () => {
        const fremd = await createDevice(server.users.fremd.id);
        await fremd.sync();
        await fremd.repo.addNote(server.households.fremd.id, { title: "Alt" });
        await fremd.sync();
        await server.client.exec(
            `alter table notes disable trigger notes_set_updated_at; update notes set updated_at = now() - interval '1 hour'; alter table notes enable trigger notes_set_updated_at;`,
        );
        await server.client.query(`insert into household_users (household_id, user_id, role) values ($1, $2, 'MEMBER')`, [
            server.households.fremd.id,
            server.users.anna.id,
        ]);
        // 1. Durchlauf sieht den neuen Haushalt, der 2. (Vollabgleich) scheitert
        const original = globalThis.fetch;
        let n = 0;
        globalThis.fetch = (async (i: RequestInfo | URL, init?: RequestInit) => {
            if (++n === 2) throw new TypeError("offline");
            return original(i, init);
        }) as typeof fetch;
        await annasPhone.sync();
        globalThis.fetch = original;
        // App neu gestartet (gleiche IndexedDB, frischer Speicher)
        const restarted = await createDevice(server.users.anna.id, annasPhone.factory);
        await restarted.sync();
        expect((await restarted.db.notes.toArray()).map((x) => x.title)).toContain("Alt");
    });

    it("Rückgängig nach dem Löschen kommt auch bei den anderen an – selbst wenn das Löschen schon übertragen war", async () => {
        const listId = await phone.repo.addList(householdId, "Einkauf");
        const itemId = await phone.repo.addItem(listId, "Milch");
        await phone.sync();
        await annasPhone.sync();
        const snapshot = (await phone.db.todoItems.get(itemId))!;
        await phone.repo.deleteItem(itemId);
        await phone.sync(); // Löschen ist beim Server
        await phone.repo.restoreItems([snapshot]);
        await phone.sync();
        await annasPhone.sync();
        expect((await annasPhone.db.todoItems.where("listId").equals(listId).toArray()).map((i) => i.content)).toEqual(["Milch"]);
        expect(await server.count("todo_items", "deleted_at is null")).toBe(1);
    });

    it("ein gerade angelegter Haushalt verschwindet nicht durch eine ältere Sync-Antwort", async () => {
        let release!: () => void;
        responseGate = new Promise((r) => (release = r));
        const running = phone.sync(); // Antwort ist berechnet, kommt aber erst gleich an
        await new Promise((r) => setTimeout(r, 50));
        const [neu] = await server.db.insert(households).values({ name: "Ferienhaus", createdBy: server.users.moritz.id }).returning();
        await server.db.insert(householdUsers).values({ householdId: neu.id, userId: server.users.moritz.id, role: "OWNER" });
        await phone.db.households.put({ id: neu.id, name: "Ferienhaus", role: "OWNER" }); // wie nach createHousehold
        responseGate = null;
        release();
        await running;
        expect(await phone.db.households.get(neu.id)).toBeDefined();
        await phone.sync();
        expect((await phone.db.households.toArray()).map((h) => h.name).sort()).toEqual(["Ferienhaus", "Zuhause"]);
    });

    it("sendet nichts, wenn im Browser inzwischen ein anderes Konto angemeldet ist", async () => {
        const noteId = await phone.repo.addNote(householdId, { title: "Moritz privat" });
        phone.engine.setSyncUserForTests(server.users.moritz.id);
        activeUserId = server.users.anna.id; // Cookie gehört Anna
        await phone.engine.runSync();
        expect(phone.engine.getSyncState().status).toBe("unauthenticated");
        expect(await server.count("notes", `id = '${noteId}'`)).toBe(0);
        expect((await phone.outbox()).length).toBe(1); // bleibt für Moritz erhalten
    });
});

describe("Upgrade von Version 1", () => {
    it("übernimmt hängengebliebene Offline-Änderungen aus der alten Queue", async () => {
        // Altes Gerät: Datenbank im Format von Version 1 mit ausstehenden Änderungen
        vi.resetModules();
        globalThis.indexedDB = new IDBFactory();
        const { default: Dexie } = await import("dexie");
        const v1 = new Dexie("MyHomeDB", { indexedDB: globalThis.indexedDB, IDBKeyRange });
        v1.version(1).stores({
            households: "id, name, userId",
            meters: "id, name, type, householdId",
            readings: "id, meterId, date",
            todoLists: "id, name, householdId",
            todoItems: "id, listId, content",
            notes: "id, title, householdId",
            syncQueue: "++id, type, entity, status, timestamp",
        });
        await v1.table("notes").add({ id: 7, title: "alt", householdId });
        await v1.table("syncQueue").bulkAdd([
            { type: "CREATE", entity: "NOTE", data: { householdId, title: "Offline geschrieben", tempId: -1 }, timestamp: Date.now(), status: "PENDING" },
            { type: "UPDATE", entity: "NOTE", data: { id: -1, isPinned: "true", type: "TOGGLE_PIN" }, timestamp: Date.now(), status: "SYNCING" },
        ]);
        v1.close();

        const offlineDb = await import("@/lib/offline/db");
        const engine = await import("@/lib/offline/sync-engine");
        expect(await offlineDb.db.legacyQueue.count()).toBe(2);
        expect(await offlineDb.db.notes.count()).toBe(0); // alte Integer-Daten verworfen

        activeUserId = server.users.moritz.id;
        await engine.runSync();
        activeUserId = null;

        expect(await offlineDb.db.legacyQueue.count()).toBe(0);
        const notes = await offlineDb.db.notes.toArray();
        expect(notes).toHaveLength(1);
        expect(notes[0]).toMatchObject({ title: "Offline geschrieben", isPinned: true });
    });
});

describe("Upgrade von Version 1 – große Queue", () => {
    async function legacyDevice(entries: Record<string, unknown>[]) {
        vi.resetModules();
        globalThis.indexedDB = new IDBFactory();
        const { default: Dexie } = await import("dexie");
        const v1 = new Dexie("MyHomeDB", { indexedDB: globalThis.indexedDB, IDBKeyRange });
        v1.version(1).stores({
            households: "id, name, userId",
            meters: "id, name, type, householdId",
            readings: "id, meterId, date",
            todoLists: "id, name, householdId",
            todoItems: "id, listId, content",
            notes: "id, title, householdId",
            syncQueue: "++id, type, entity, status, timestamp",
        });
        await v1.table("syncQueue").bulkAdd(entries);
        v1.close();
        const offlineDb = await import("@/lib/offline/db");
        const engine = await import("@/lib/offline/sync-engine");
        return { db: offlineDb.db, engine };
    }

    it("überträgt in Teilen, löst temporäre IDs über Teilgrenzen auf und legt bei Wiederholung nichts doppelt an", async () => {
        const ts = Date.now();
        const entries = [
            { type: "CREATE", entity: "LIST", data: { householdId, name: "Groß", tempId: -1 }, timestamp: ts, status: "PENDING" },
            ...Array.from({ length: 250 }, (_, i) => ({
                type: "CREATE",
                entity: "ITEM",
                data: { listId: -1, content: `Punkt ${i}`, tempId: -(i + 2) },
                timestamp: ts,
                status: "PENDING",
            })),
            { type: "UPDATE", entity: "ITEM", data: { id: -251, completed: true }, timestamp: ts, status: "PENDING" },
            { type: "CREATE", entity: "NOTE", data: { householdId, title: "kaputt" }, timestamp: 1e20, status: "PENDING" },
        ];
        const device = await legacyDevice(entries);

        activeUserId = server.users.moritz.id;
        dropNextResponses = 1; // erster Teil kommt an, Antwort geht verloren
        await device.engine.runSync();
        await device.engine.runSync();
        activeUserId = null;

        expect(await device.db.legacyQueue.count()).toBe(0);
        expect(await server.count("todo_lists")).toBe(1);
        expect(await server.count("todo_items")).toBe(250);
        expect(await server.count("todo_items", "completed")).toBe(1);
        expect(await server.count("notes")).toBe(1); // unplausibler Zeitstempel ignoriert, Notiz trotzdem übernommen
        expect(await device.db.todoItems.count()).toBe(250);
    });

    it("vorübergehende Serverfehler verwerfen die alte Queue nicht – und blockieren den Sync nicht", async () => {
        const device = await legacyDevice([
            { type: "CREATE", entity: "NOTE", data: { householdId, title: "aus Version 1" }, timestamp: Date.now(), status: "PENDING" },
        ]);
        const repo = await import("@/lib/offline/repo");
        await repo.addNote(householdId, { title: "Neu" });
        activeUserId = server.users.moritz.id;
        failNextRequests = 1; // z. B. 500/429 bei der Übernahme
        await device.engine.runSync();
        expect(await device.db.legacyQueue.count()).toBe(1);
        expect(await server.count("notes", "title = 'Neu'")).toBe(1);
        await device.engine.runSync();
        activeUserId = null;
        expect(await device.db.legacyQueue.count()).toBe(0);
        expect(await server.count("notes", "title = 'aus Version 1'")).toBe(1);
    });

    it("eine unlesbare alte Queue blockiert den normalen Sync nicht", async () => {
        const device = await legacyDevice([{ type: "CREATE", entity: "NOTE", data: "kaputt", status: "PENDING" }]);
        const repo = await import("@/lib/offline/repo");
        await repo.addNote(householdId, { title: "Neu" });
        activeUserId = server.users.moritz.id;
        await device.engine.runSync();
        activeUserId = null;
        expect(device.engine.getSyncState().status).toBe("idle");
        expect(await server.count("notes")).toBe(1);
        expect(await device.db.legacyQueue.count()).toBe(0);
    });
});
