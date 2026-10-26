import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

const repo = await import("@/lib/offline/repo");
const { db } = await import("@/lib/offline/db");

async function items(listId: string) {
    return (await db.todoItems.where("listId").equals(listId).toArray()).map((i) => `${i.content}${i.completed ? " ✓" : ""}`).sort();
}

describe("Punkte hinzufügen", () => {
    it("legt keinen doppelten Punkt an – egal ob Groß-/Kleinschreibung oder Leerzeichen abweichen", async () => {
        const listId = await repo.addList(1, "Einkauf");
        const first = await repo.addItems(listId, ["Hafer milch"]);
        const second = await repo.addItems(listId, ["  hafer   Milch "]);
        expect(second).toEqual({ added: [], revived: [], existing: first.added });
        expect(await items(listId)).toEqual(["Hafer milch"]);
    });

    it("holt einen erledigten Punkt zurück auf die Liste, statt ihn neu anzulegen", async () => {
        const listId = await repo.addList(1, "Einkauf");
        const { added } = await repo.addItems(listId, ["Milch"]);
        await repo.updateItem(added[0], { completed: true });
        const result = await repo.addItems(listId, ["milch"]);
        expect(result.revived).toEqual(added);
        expect(await items(listId)).toEqual(["Milch"]);
        // Die Änderung landet ganz normal in der Outbox (hier noch ins ungesendete create gefaltet)
        const ops = (await db.outbox.where("entityId").equals(added[0]).toArray()).map((e) => e.op);
        expect(ops.at(-1)).toMatchObject({ fields: { completed: false } });
    });

    it("übernimmt mehrere Zeilen auf einmal und entfernt Aufzählungszeichen", async () => {
        const listId = await repo.addList(1, "Einkauf");
        await repo.addItems(listId, ["Brot"]);
        const lines = repo.splitItemLines("- Milch\n• Brot\r\n\n2. Eier\n[ ] Kaffee\n[x] Milch\n   ");
        expect(lines).toEqual(["Milch", "Brot", "Eier", "Kaffee", "Milch"]);
        const result = await repo.addItems(listId, lines);
        expect(result.added).toHaveLength(3);
        expect(result.existing).toHaveLength(1); // Brot – und Milch zählt nur einmal
        expect(await items(listId)).toEqual(["Brot", "Eier", "Kaffee", "Milch"]);
    });
});
