/**
 * Ende-zu-Ende-Tests des Offline-Syncs: echte Client-Engine (Dexie auf
 * fake-indexeddb) ↔ echter Route Handler /api/sync ↔ echte Datenbank (PGlite).
 * Jedes "Gerät" hat seine eigene IndexedDB.
 */
import "fake-indexeddb/auto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupServer, type TestServer } from "../support/server";

let activeUserId: number | null = null;
let failNextRequests = 0;
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
    if (offline) throw new TypeError("Failed to fetch");
    if (failNextRequests > 0) {
        failNextRequests--;
        return new Response("boom", { status: 500 });
    }
    const url = String(input);
    const request = new Request(`http://localhost${url}`, init);
    if (url === "/api/sync") return routes.sync.POST(request);
    if (url === "/api/sync/legacy") return routes.legacy.POST(request);
    return new Response("not found", { status: 404 });
}) as typeof fetch;

type Device = Awaited<ReturnType<typeof createDevice>>;

/** Ein Gerät = eigene IndexedDB + eigene Instanz von Repo/Engine. */
async function createDevice(userId: number) {
    vi.resetModules();
    const factory = new IDBFactory();
    globalThis.indexedDB = factory;
    globalThis.IDBKeyRange = IDBKeyRange;
    const offlineDb = await import("@/lib/offline/db");
    const repo = await import("@/lib/offline/repo");
    const engine = await import("@/lib/offline/sync-engine");
    return {
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
