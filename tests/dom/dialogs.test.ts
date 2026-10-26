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
