// @vitest-environment jsdom
/**
 * Dialoge im (simulierten) Browser: Verwerfen neuer Listen/Notizen – auch unter
 * React StrictMode, wie in `next dev` – und Fokus-Rückgabe nach dem Schließen.
 */
import "fake-indexeddb/auto";
import { act, createElement as h, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia ??= ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
    })) as typeof window.matchMedia;
});

const { ConfirmProvider } = await import("@/components/ui/ConfirmDialog");
const { ToastProvider } = await import("@/components/ui/Toast");
const { BaseDialog } = await import("@/components/ui/BaseDialog");
const { ListEditDialog } = await import("@/components/dashboard/list/ListEditDialog");
const { NoteEditDialog } = await import("@/components/dashboard/note/NoteEditDialog");
const { MeterDetailDialog } = await import("@/components/dashboard/meter/MeterDetailDialog");
const { sortReadings } = await import("@/lib/meter/stats");
const repo = await import("@/lib/offline/repo");
const { db } = await import("@/lib/offline/db");

let root: Root | undefined;

async function mount(node: ReactNode) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(node));
    return (next: ReactNode) => act(async () => root!.render(next));
}

async function unmount() {
    await act(async () => root?.unmount());
    root = undefined;
    await act(() => sleep(20)); // verzögertes Verwerfen abwarten
}

afterEach(async () => {
    if (root) await unmount();
    document.body.innerHTML = "";
});

describe("Neue Listen und Notizen", () => {
    it("bleiben unter StrictMode beim Öffnen erhalten und werden unberührt beim Schließen verworfen", async () => {
        const listId = await repo.addList(1, "Neue Liste");
        const noteId = await repo.addNote(1);
        const list = { ...(await db.todoLists.get(listId))!, items: [] };
        const note = (await db.notes.get(noteId))!;
        await mount(
            h(
                StrictMode,
                null,
                h(ToastProvider, null, h(ConfirmProvider, null, h(ListEditDialog, { list, created: true, onClose() {} }), h(NoteEditDialog, { note, created: true, onClose() {} }))),
            ),
        );
        await act(() => sleep(100));
        expect(await db.todoLists.get(listId)).toBeDefined();
        expect(await db.notes.get(noteId)).toBeDefined();

        await unmount();
        expect(await db.todoLists.get(listId)).toBeUndefined();
        expect(await db.notes.get(noteId)).toBeUndefined();
    });

    it("eine leere Liste, die nicht gerade hier angelegt wurde, wird nie verworfen", async () => {
        // z. B. von jemand anderem angelegt, dessen Punkte nur noch nicht angekommen sind
        const listId = await repo.addList(1, "Neue Liste");
        const list = { ...(await db.todoLists.get(listId))!, items: [] };
        await mount(h(ToastProvider, null, h(ConfirmProvider, null, h(ListEditDialog, { list, onClose() {} }))));
        await act(() => sleep(50));
        await unmount();
        expect(await db.todoLists.get(listId)).toBeDefined();
    });
});

describe("Fokus", () => {
    it("kehrt nach dem Schließen zum auslösenden Element zurück – auch bei autoFocus im Dialog", async () => {
        const opener = document.createElement("button");
        document.body.appendChild(opener);
        opener.focus();
        const dialog = (open: boolean) => h(BaseDialog, { isOpen: open, onClose() {}, title: "T", children: h("input", { autoFocus: true, "aria-label": "Wert" }) });
        const rerender = await mount(dialog(true));
        await act(() => sleep(80));
        expect(document.activeElement?.getAttribute("aria-label")).toBe("Wert");
        await rerender(dialog(false));
        await act(() => sleep(600)); // Ausblend-Animation
        expect(document.activeElement).toBe(opener);
        expect(document.body.style.overflow).toBe("");
    });
});

/** Wert in ein von React kontrolliertes Eingabefeld schreiben */
function setInput(el: HTMLInputElement, value: string) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
}

const click = (el: Element) => act(async () => (el as HTMLElement).click());
const buttons = (label: string) => [...document.querySelectorAll<HTMLButtonElement>(`button[aria-label="${label}"]`)];

describe("Zähler: Ablesung bearbeiten (Prüfung B6/B11)", () => {
    async function setup() {
        const meterId = await repo.addMeter(1, { type: "ELECTRICITY", unit: "kWh" });
        const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
        await repo.addReading(meterId, { value: 9800, date: day(30), isReplacement: false });
        await repo.addReading(meterId, { value: 10000, date: day(20), isReplacement: false });
        await repo.addReading(meterId, { value: 5, date: day(19), isReplacement: false }); // neuer Zähler, nicht markiert
        await repo.addReading(meterId, { value: 105, date: day(9), isReplacement: false });
        const load = async () => ({ ...(await db.meters.get(meterId))!, readings: sortReadings(await db.readings.where("meterId").equals(meterId).toArray()) });
        const dialog = (meter: Awaited<ReturnType<typeof load>>) =>
            h(ConfirmProvider, null, h(ToastProvider, null, h(MeterDetailDialog, { meter, onClose() {}, onAddReading() {} })));
        const rerender = await mount(dialog(await load()));
        await act(() => sleep(50));
        return { meterId, load, rerender: async () => rerender(dialog(await load())) };
    }

    it("markiert den Rückgang im Verlauf und lässt ihn nachträglich als Zählerwechsel markieren", async () => {
        const { meterId, rerender } = await setup();
        expect(document.body.textContent).toContain("Zählerwechsel?");
        expect(document.body.textContent).toContain("War das ein Zählerwechsel?");

        // Verlauf ist absteigend: [105, 5, 10000, 9800] → zweite Zeile bearbeiten
        await click(buttons("Ablesung bearbeiten")[1]);
        const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        expect(checkbox.checked).toBe(false);
        await click(checkbox);
        await click(buttons("Speichern")[0]);
        await act(() => sleep(20));

        const edited = (await db.readings.where("meterId").equals(meterId).toArray()).find((r) => r.value === 5)!;
        expect(edited.isReplacement).toBe(true);
        await rerender();
        expect(document.body.textContent).not.toContain("War das ein Zählerwechsel?");
    });

    it("prüft geänderte Stände wie beim Eintragen und lehnt ein Datum in der Zukunft ab", async () => {
        const { meterId } = await setup();
        // neueste Ablesung 105 → 99999: weit über dem üblichen Verbrauch
        await click(buttons("Ablesung bearbeiten")[0]);
        const value = document.querySelector<HTMLInputElement>('input[aria-label="Zählerstand"]')!;
        await act(async () => setInput(value, "99999"));
        await click(buttons("Speichern")[0]);
        expect(document.body.textContent).toContain("Stimmt der Wert?");
        expect((await db.readings.where("meterId").equals(meterId).toArray()).some((r) => r.value === 99999)).toBe(false);
        // zweites Tippen bestätigt
        await click(buttons("Trotzdem speichern")[0]);
        await act(() => sleep(20));
        expect((await db.readings.where("meterId").equals(meterId).toArray()).some((r) => r.value === 99999)).toBe(true);
    });

    it("Datum in der Zukunft wird nicht gespeichert", async () => {
        const { meterId } = await setup();
        await click(buttons("Ablesung bearbeiten")[0]);
        const date = document.querySelector<HTMLInputElement>('input[aria-label="Datum"]')!;
        const future = new Date(Date.now() + 3 * 86_400_000);
        const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
        await act(async () => setInput(date, iso));
        await click(buttons("Speichern")[0]);
        await act(() => sleep(20));
        expect(document.body.textContent).toContain("Zukunft");
        const latest = (await db.readings.where("meterId").equals(meterId).toArray()).find((r) => r.value === 105)!;
        expect(Date.parse(latest.date)).toBeLessThan(Date.now());
    });
});
