"use client";

import { Gauge, Home, ListTodo, StickyNote } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createHousehold } from "@/app/actions/households";
import { BottomNav, type TabId } from "@/components/navigation/BottomNav";
import { AddTile, EmptyState } from "@/components/ui/AddTile";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { runAction } from "@/lib/client-actions";
import { db } from "@/lib/offline/db";
import { useHouseholdData, useHouseholds, useSyncState } from "@/lib/offline/hooks";
import { addList, addNote, updateItem, updateList, updateMeter, updateNote } from "@/lib/offline/repo";
import { startUserSync } from "@/lib/offline/session";
import { requestSync } from "@/lib/offline/sync-engine";
import type { SessionUser } from "@/lib/sync/types";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { HouseholdMenu } from "./household/HouseholdMenu";
import { HouseholdSettingsDialog } from "./household/HouseholdSettingsDialog";
import { ListEditDialog, NEW_LIST_NAME } from "./list/ListEditDialog";
import { ListWidget } from "./list/ListWidget";
import { AddMeterDialog } from "./meter/AddMeterDialog";
import { MeterDetailDialog } from "./meter/MeterDetailDialog";
import { MeterReadingDialog } from "./meter/MeterReadingDialog";
import { MeterWidget } from "./meter/MeterWidget";
import { NoteEditDialog } from "./note/NoteEditDialog";
import { NoteWidget } from "./note/NoteWidget";
import { ProfileTab } from "./ProfileTab";

type DialogKind =
    | { kind: "note"; id: string; created?: boolean }
    | { kind: "list"; id: string; created?: boolean }
    | { kind: "reading"; id: string }
    | { kind: "meter"; id: string }
    | { kind: "add-meter" }
    | { kind: "household"; id: number };

/** `n` zählt jedes Öffnen hoch – so startet ein Formular auch beim schnellen Wiederöffnen leer. */
type DialogState = (DialogKind & { n: number }) | null;

let dialogCounter = 0;

const HOUSEHOLD_KEY = "lastHouseholdId";
const TAB_KEY = "activeTab";

function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* egal */
    }
}

function FirstHousehold() {
    const toast = useToast();
    const [name, setName] = useState("Zuhause");
    const [busy, setBusy] = useState(false);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        const result = await runAction(() => createHousehold({ name }));
        setBusy(false);
        if (!result.ok) return toast({ message: result.error, variant: "error" });
        await db.households.put(result.data);
        requestSync({ immediate: true });
    };
    return (
        <EmptyState>
            <Home className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="font-bold text-foreground">Willkommen! Lege deinen ersten Haushalt an.</p>
            <p>Du kannst später weitere Personen einladen – oder selbst über einen Einladungslink beitreten.</p>
            <form onSubmit={submit} className="flex gap-2 max-w-xs mx-auto pt-2">
                <input aria-label="Name des Haushalts" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="input-field flex-1 min-w-0" />
                <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary px-4">
                    {busy ? <Spinner className="text-primary-foreground" /> : "Anlegen"}
                </button>
            </form>
        </EmptyState>
    );
}

export function Dashboard({ user }: { user: SessionUser }) {
    const households = useHouseholds();
    const sync = useSyncState();
    const [preferredHousehold, setPreferredHousehold] = useState<number | null>(() => Number(readStorage(HOUSEHOLD_KEY)) || null);
    const [tab, setTab] = useState<TabId>(() => {
        // z. B. aus einer Push-Benachrichtigung: /?tab=meters
        const fromUrl = new URLSearchParams(window.location.search).get("tab");
        const valid: TabId[] = ["dashboard", "lists", "notes", "meters", "profile"];
        if (fromUrl && valid.includes(fromUrl as TabId)) return fromUrl as TabId;
        const stored = readStorage(TAB_KEY) as TabId;
        return valid.includes(stored) ? stored : "dashboard";
    });
    const [menuOpen, setMenuOpen] = useState(false);
    const [dialog, setDialogState] = useState<DialogState>(null);
    const setDialog = useCallback((next: DialogKind | null) => setDialogState(next && { ...next, n: ++dialogCounter }), []);

    useEffect(() => {
        startUserSync(user.id);
        if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    }, [user.id]);

    const householdId = households?.some((h) => h.id === preferredHousehold) ? preferredHousehold : (households?.[0]?.id ?? null);
    const household = households?.find((h) => h.id === householdId);
    const data = useHouseholdData(householdId);

    const selectHousehold = useCallback((id: number) => {
        setPreferredHousehold(id);
        writeStorage(HOUSEHOLD_KEY, String(id));
        setMenuOpen(false);
    }, []);

    const changeTab = useCallback((next: TabId) => {
        setTab(next);
        writeStorage(TAB_KEY, next);
        window.scrollTo({ top: 0 });
    }, []);

    // Stabile Callbacks für die (memoisierten) Widgets
    const openNote = useCallback((id: string) => setDialog({ kind: "note", id }), [setDialog]);
    const openList = useCallback((id: string) => setDialog({ kind: "list", id }), [setDialog]);
    const openMeter = useCallback((id: string) => setDialog({ kind: "meter", id }), [setDialog]);
    const openReading = useCallback((id: string) => setDialog({ kind: "reading", id }), [setDialog]);
    const pinNote = useCallback((id: string, isPinned: boolean) => void updateNote(id, { isPinned }), []);
    const pinList = useCallback((id: string, isPinned: boolean) => void updateList(id, { isPinned }), []);
    const pinMeter = useCallback((id: string, isPinned: boolean) => void updateMeter(id, { isPinned }), []);
    const toggleItem = useCallback((id: string, completed: boolean) => void updateItem(id, { completed }), []);
    const closeDialog = useCallback(() => setDialog(null), [setDialog]);

    const neverSynced = sync.lastSyncedAt === null;
    if (households === undefined || (households.length === 0 && neverSynced && sync.status !== "offline" && sync.status !== "error")) {
        return <DashboardSkeleton />;
    }

    const meters = data?.meters ?? [];
    const lists = data?.lists ?? [];
    const notes = data?.notes ?? [];

    const meterWidget = (m: (typeof meters)[number]) => (
        <MeterWidget key={m.id} meter={m} onAddReading={openReading} onOpen={openMeter} onTogglePin={pinMeter} />
    );
    const listWidget = (l: (typeof lists)[number]) => (
        <ListWidget key={l.id} list={l} onOpen={openList} onTogglePin={pinList} onToggleItem={toggleItem} />
    );
    const noteWidget = (n: (typeof notes)[number]) => <NoteWidget key={n.id} note={n} onOpen={openNote} onTogglePin={pinNote} />;

    const pinned = [...meters.filter((m) => m.isPinned).map(meterWidget), ...lists.filter((l) => l.isPinned).map(listWidget), ...notes.filter((n) => n.isPinned).map(noteWidget)];
    // Solange das Dashboard leer ist, landen neue Elemente direkt dort
    const autoPin = pinned.length === 0;

    const createList = async () => {
        if (!household) return;
        const id = await addList(household.id, NEW_LIST_NAME, { isPinned: autoPin });
        setDialog({ kind: "list", id, created: true });
    };
    const createNote = async () => {
        if (!household) return;
        const id = await addNote(household.id, { isPinned: autoPin });
        setDialog({ kind: "note", id, created: true });
    };
    const isEmpty = meters.length + lists.length + notes.length === 0;

    let content: React.ReactNode;
    if (tab === "profile") {
        content = <ProfileTab user={user} />;
    } else if (!household) {
        content =
            households.length === 0 && neverSynced ? (
                <EmptyState>Keine Verbindung – deine Daten werden geladen, sobald du online bist.</EmptyState>
            ) : (
                <FirstHousehold />
            );
    } else if (!data) {
        content = <DashboardSkeleton hideHeader />;
    } else if (tab === "dashboard") {
        content =
            pinned.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{pinned}</div>
            ) : (
                <EmptyState>
                    <p>
                        {isEmpty
                            ? "Willkommen! Leg los mit deinem ersten Zähler, einer Einkaufsliste oder einer Notiz."
                            : "Hefte Zähler, Listen oder Notizen mit der Pinnnadel an, um sie hier zu sehen."}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                        <button
                            type="button"
                            className="btn btn-secondary px-4 py-2.5 text-xs"
                            onClick={() => {
                                changeTab("meters");
                                setDialog({ kind: "add-meter" });
                            }}
                        >
                            <Gauge className="w-4 h-4" /> Zähler
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary px-4 py-2.5 text-xs"
                            onClick={() => {
                                changeTab("lists");
                                void createList();
                            }}
                        >
                            <ListTodo className="w-4 h-4" /> Liste
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary px-4 py-2.5 text-xs"
                            onClick={() => {
                                changeTab("notes");
                                void createNote();
                            }}
                        >
                            <StickyNote className="w-4 h-4" /> Notiz
                        </button>
                    </div>
                </EmptyState>
            );
    } else if (tab === "lists") {
        content = (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lists.map(listWidget)}
                <AddTile label="Liste hinzufügen" onClick={() => void createList()} />
            </div>
        );
    } else if (tab === "notes") {
        content = (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {notes.map(noteWidget)}
                <AddTile label="Notiz hinzufügen" onClick={() => void createNote()} />
            </div>
        );
    } else {
        content = (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {meters.map(meterWidget)}
                <AddTile label="Zähler hinzufügen" onClick={() => setDialog({ kind: "add-meter" })} />
            </div>
        );
    }

    const find = <T extends { id: string }>(items: T[], kind: string) => (dialog && dialog.kind === kind && "id" in dialog ? items.find((i) => i.id === dialog.id) : undefined);

    return (
        <>
            <DashboardHeader title={household?.name ?? "My Home"} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)}>
                <HouseholdMenu
                    isOpen={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    households={households}
                    selectedHouseholdId={householdId}
                    onSelect={selectHousehold}
                    onOpenSettings={(id) => {
                        setMenuOpen(false);
                        setDialog({ kind: "household", id });
                    }}
                />
            </DashboardHeader>

            <main className="min-h-[100dvh] px-4 md:px-8 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-[calc(9rem+env(safe-area-inset-bottom))] max-w-7xl mx-auto bg-background text-foreground">
                {content}
            </main>

            <BottomNav activeTab={tab} onTabChange={changeTab} />

            {household && (
                <AddMeterDialog
                    householdId={household.id}
                    isOpen={dialog?.kind === "add-meter"}
                    onClose={closeDialog}
                    onCreated={(id) => setDialog({ kind: "reading", id })}
                    pinByDefault={autoPin}
                />
            )}
            <MeterReadingDialog meter={find(meters, "reading")} instance={dialog?.n} onClose={closeDialog} onOpenDetails={openMeter} />
            <MeterDetailDialog meter={find(meters, "meter")} instance={dialog?.n} onClose={closeDialog} onAddReading={openReading} />
            <ListEditDialog list={find(lists, "list")} instance={dialog?.n} created={dialog?.kind === "list" && !!dialog.created} onClose={closeDialog} />
            <NoteEditDialog note={find(notes, "note")} instance={dialog?.n} created={dialog?.kind === "note" && !!dialog.created} onClose={closeDialog} />
            <HouseholdSettingsDialog household={dialog?.kind === "household" ? households.find((h) => h.id === dialog.id) : undefined} onClose={closeDialog} />
        </>
    );
}
