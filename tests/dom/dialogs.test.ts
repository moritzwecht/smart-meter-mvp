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
const { MeterWidget } = await import("@/components/dashboard/meter/MeterWidget");
const { ConsumptionChart } = await import("@/components/dashboard/meter/ConsumptionChart");
const { MeterCostFields, emptyMeterForm } = await import("@/components/dashboard/meter/MeterForm");
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

    it("prüft geänderte Stände wie beim Eintragen – zweites Tippen bestätigt", async () => {
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

describe("Zähler: Bearbeiten ohne Seiteneffekte (Nachbesserung)", () => {
    const pastDay = (n: number) => {
        const d = new Date(Date.now() - n * 86_400_000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const noon = (n: number) => {
        const d = new Date(Date.now() - n * 86_400_000);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
    };

    async function setup(readings: { value: number; date: string }[]) {
        const meterId = await repo.addMeter(1, { type: "ELECTRICITY", unit: "kWh" });
        for (const x of readings) await repo.addReading(meterId, { ...x, isReplacement: false });
        const load = async () => ({ ...(await db.meters.get(meterId))!, readings: sortReadings(await db.readings.where("meterId").equals(meterId).toArray()) });
        await mount(h(ConfirmProvider, null, h(ToastProvider, null, h(MeterDetailDialog, { meter: await load(), onClose() {}, onAddReading() {} }))));
        await act(() => sleep(50));
        return { meterId, all: () => db.readings.where("meterId").equals(meterId).sortBy("value") };
    }

    it("Speichern ohne Änderung ändert nichts – auch nicht die Millisekunden", async () => {
        const date = new Date(Date.now() - 3 * 86_400_000 + 123).toISOString();
        const { all } = await setup([{ value: 100, date: noon(10) }, { value: 200, date }]);
        const before = await all();
        await click(buttons("Ablesung bearbeiten")[0]);
        await click(buttons("Speichern")[0]);
        await act(() => sleep(20));
        expect(await all()).toEqual(before);
        expect(document.querySelector('input[aria-label="Zählerstand"]')).toBeNull(); // Bearbeiten beendet
    });

    it("auf einen Tag mit einer anderen Ablesung verschieben: beide zählen, eine Minute auseinander", async () => {
        const { all } = await setup([
            { value: 1000, date: noon(40) },
            { value: 1100, date: noon(30) },
            { value: 1200, date: noon(20) },
            { value: 1300, date: noon(10) },
        ]);
        // Verlauf absteigend: [1300, 1200, 1100, 1000] → 1200 auf den Tag von 1100 legen
        await click(buttons("Ablesung bearbeiten")[1]);
        await act(async () => setInput(document.querySelector<HTMLInputElement>('input[aria-label="Datum"]')!, pastDay(30)));
        await click(buttons("Speichern")[0]);
        // 100 kWh in einer Minute: zu Recht eine Warnung – bestätigen
        expect(document.body.textContent).toContain("Stimmt der Wert?");
        await click(buttons("Trotzdem speichern")[0]);
        await act(() => sleep(20));
        const rows = await all();
        expect(Date.parse(rows[2].date) - Date.parse(rows[1].date)).toBe(60_000);
        const { toSegments } = await import("@/lib/meter/stats");
        const { segments, anomalies } = toSegments(rows);
        expect(anomalies).toBe(0);
        expect(segments.reduce((s, x) => s + x.consumption, 0)).toBe(300);
    });
});

describe("Zähler: Anzeigen (Prüfung B3/B4/B5/B2)", () => {
    const DAY = 86_400_000;
    const meter = (fields: Record<string, unknown>, readings: [daysAgo: number, value: number][]) => ({
        id: "m1",
        householdId: 1,
        name: "Zähler",
        type: "ELECTRICITY" as const,
        unit: "kWh",
        isPinned: false,
        monthlyPayment: null,
        basicFee: null,
        pricePerUnit: null,
        priceUnit: null,
        zNumber: null,
        calorificValue: null,
        billingStart: null,
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
        ...fields,
        readings: readings.map(([days, value], i) => ({
            id: `r${i}`,
            meterId: "m1",
            value,
            date: new Date(Date.now() - days * DAY).toISOString(),
            isReplacement: false,
            source: "app",
            createdAt: "",
            updatedAt: "",
            deletedAt: null,
        })),
    });
    const details = (m: ReturnType<typeof meter>) =>
        mount(h(ConfirmProvider, null, h(ToastProvider, null, h(MeterDetailDialog, { meter: m as never, onClose() {}, onAddReading() {} }))));
    const text = () => document.body.textContent ?? "";

    it("B4: angebrochener Monat heißt „erfasst“, nicht „Schätzung“ – auch für Screenreader", async () => {
        await mount(h(ConsumptionChart, { buckets: [{ month: "2026-09", consumption: 300, coverage: 1 }, { month: "2026-10", consumption: 144, coverage: 0.48 }], unit: "kWh", colorClass: "" }));
        expect(text()).toContain("erfasst: 48 % des Monats");
        expect(text()).not.toContain("Schätzung");
        expect(document.querySelector('button[aria-pressed="true"]')?.getAttribute("aria-label")).toContain("erfasst: 48 % des Monats");
    });

    it("B5: Monatskosten enthalten die Grundgebühr", async () => {
        // 10 kWh/Tag × 0,30 € × 30,44 Tage + 10 € = 101,31 €
        await details(meter({ pricePerUnit: 0.3, basicFee: 10 }, [[60, 1000], [30, 1300], [0, 1600]]));
        expect(text()).toMatch(/≈ 101,31\s€ pro Monat inkl\. Grundgebühr/);
    });

    it("B2: Gas pro kWh ohne Zustandszahl/Brennwert zeigt einen Hinweis statt Kosten", async () => {
        await details(meter({ type: "GAS", unit: "m³", pricePerUnit: 0.11, priceUnit: "kwh", monthlyPayment: 100 }, [[60, 1000], [0, 1300]]));
        expect(text()).toContain("fehlen Zustandszahl und Brennwert");
        expect(text()).not.toContain("Kosten (Prognose)");
    });

    it("B2: Gas pro kWh mit Litern: Hinweis passt zur Einheit", async () => {
        await details(meter({ type: "GAS", unit: "l", pricePerUnit: 0.11, priceUnit: "kwh" }, [[60, 1000], [0, 1300]]));
        expect(text()).toContain("lässt sich nicht umrechnen");
    });

    it("B2: Hinweis, wenn ein Gaspreis pro m³ nach einem Preis pro kWh aussieht", async () => {
        const form = { ...emptyMeterForm("GAS"), priceUnit: null, pricePerUnit: "0,11" };
        const rerender = await mount(h(MeterCostFields, { form, onChange() {}, idPrefix: "t" }));
        expect(text()).toContain("Gaspreise stehen meist pro kWh");
        await rerender(h(MeterCostFields, { form: { ...form, pricePerUnit: "1,20" }, onChange() {}, idPrefix: "t" }));
        expect(text()).not.toContain("Gaspreise stehen meist pro kWh");
    });

    it("B3: wenige Daten → „unsicher“ im Widget, unter 14 Tagen gar keine Prognose", async () => {
        const m = meter({ pricePerUnit: 0.3, monthlyPayment: 100 }, [[40, 1000], [0, 1400]]);
        await mount(h(MeterWidget, { meter: m as never, onAddReading() {}, onOpen() {}, onTogglePin() {} }));
        expect(text()).toContain("unsicher");
        await unmount();
        await details(meter({ pricePerUnit: 0.3, monthlyPayment: 100 }, [[2, 1000], [0, 1020]]));
        expect(text()).toContain("mindestens 14 Tage");
        expect(text()).not.toContain("Prognose Jahr");
    });
});
