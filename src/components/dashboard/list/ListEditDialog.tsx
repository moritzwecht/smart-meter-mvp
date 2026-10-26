"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Eraser, Plus, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { ListWithItems } from "@/lib/offline/hooks";
import {
    addItems,
    clearCompletedItems,
    deleteItem,
    deleteList,
    discardListIfUntouched,
    splitItemLines,
    updateItem,
    updateList,
    type AddItemsResult,
} from "@/lib/offline/repo";
import type { TodoItem } from "@/lib/sync/types";
import { useFinalUnmount } from "@/lib/use-final-unmount";
import { cn } from "@/lib/utils";

export const NEW_LIST_NAME = "Neue Liste";

/** Kurze Rückmeldung nach dem Hinzufügen – nur, wenn es etwas zu sagen gibt. */
function describeAdd(result: AddItemsResult, contents: string[], before: TodoItem[]): string {
    const name = (id: string) => before.find((i) => i.id === id)?.content ?? "";
    if (contents.length === 1) {
        if (result.existing.length) return `„${name(result.existing[0])}“ steht schon auf der Liste.`;
        if (result.revived.length) return `„${name(result.revived[0])}“ ist wieder auf der Liste.`;
        return "";
    }
    const parts = [
        result.added.length && `${result.added.length} ${result.added.length === 1 ? "Punkt" : "Punkte"} hinzugefügt`,
        result.revived.length && `${result.revived.length} wieder auf der Liste`,
        result.existing.length && `${result.existing.length} schon vorhanden`,
    ].filter(Boolean);
    return parts.length ? `${parts.join(", ")}.` : "";
}

function ListEditor({ list, created }: { list: ListWithItems; created: boolean }) {
    const [name, setName] = useState(list.name);
    const [newItem, setNewItem] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);

    // Gerade eben hier angelegt (nicht nur zufällig leer – die Liste könnte sonst
    // jemand anderem gehören, dessen Punkte nur noch nicht angekommen sind)
    const [isNew] = useState(created);
    // Namen direkt fokussieren und markieren, damit man sofort lostippen kann
    useLayoutEffect(() => {
        if (isNew) nameRef.current?.select();
    }, [isNew]);

    // Name beim Schließen sicher speichern (auch bei ESC / Tippen auf den Hintergrund);
    // eine neue, unberührte Liste wird wieder verworfen.
    const pendingName = useRef<string | null>(null);
    const listId = list.id;
    useFinalUnmount(() => {
        const value = pendingName.current?.trim();
        void (async () => {
            if (value) await updateList(listId, { name: value });
            if (isNew) await discardListIfUntouched(listId, NEW_LIST_NAME);
        })();
    });

    const saveName = () => {
        const trimmed = name.trim();
        pendingName.current = null;
        if (trimmed && trimmed !== list.name) void updateList(list.id, { name: trimmed });
        else if (!trimmed) setName(list.name);
    };

    // Rückmeldung, wenn ein Punkt schon draufstand oder wieder aktiviert wurde
    const [hint, setHint] = useState("");
    const [highlight, setHighlight] = useState<Set<string>>(() => new Set());
    const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(feedbackTimer.current), []);

    const addContents = async (contents: string[]) => {
        if (!contents.length) return;
        const result = await addItems(list.id, contents);
        const message = describeAdd(result, contents, list.items);
        setHint(message);
        setHighlight(new Set([...result.revived, ...result.existing]));
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => {
            setHint("");
            setHighlight(new Set());
        }, 2500);
    };

    const add = async (e: FormEvent) => {
        e.preventDefault();
        const content = newItem.trim();
        if (!content) return;
        setNewItem("");
        inputRef.current?.focus();
        await addContents([content]);
    };

    // Mehrzeiligen Text (z. B. aus einer Nachricht oder Notiz) als einzelne Punkte übernehmen
    const paste = (e: ClipboardEvent<HTMLInputElement>) => {
        const lines = splitItemLines(e.clipboardData.getData("text"));
        if (lines.length < 2) return;
        e.preventDefault();
        void addContents(lines);
    };

    const items = [...list.items].sort((a, b) => Number(a.completed) - Number(b.completed));
    const doneCount = list.items.filter((i) => i.completed).length;

    return (
        <div className="space-y-6">
            <input
                ref={nameRef}
                autoFocus={isNew}
                type="text"
                aria-label="Name der Liste"
                value={name}
                maxLength={200}
                onChange={(e) => {
                    setName(e.target.value);
                    pendingName.current = e.target.value;
                }}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), e.preventDefault())}
                className="w-full text-lg font-black input-field"
            />

            <form onSubmit={add} className="relative flex gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Neuer Punkt …"
                    aria-label="Neuer Punkt"
                    maxLength={500}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onPaste={paste}
                    enterKeyHint="done"
                    className="flex-1 input-field"
                />
                <button type="submit" disabled={!newItem.trim()} className="btn btn-primary px-5" aria-label="Punkt hinzufügen">
                    <Plus className="w-5 h-5" />
                </button>
                {/* Im Abstand unter dem Feld – verschiebt die Liste nicht */}
                <p role="status" className={cn("absolute left-1 top-full mt-1 text-xs text-muted-foreground transition-opacity", !hint && "opacity-0")}>
                    {hint}
                </p>
            </form>

            <ul className="space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
                    {items.map((item) => (
                        <motion.li
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ layout: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.15 } }}
                            className={cn(
                                "flex items-center gap-1 pl-3 pr-1 bg-accent/30 rounded-xl group hover:bg-accent/50 transition-[background-color,box-shadow]",
                                highlight.has(item.id) && "ring-2 ring-primary/40 bg-primary/5",
                            )}
                        >
                            {/* Die ganze Zeile hakt ab – nicht nur das kleine Kästchen */}
                            <button
                                type="button"
                                onClick={() => updateItem(item.id, { completed: !item.completed })}
                                aria-pressed={item.completed}
                                className="flex-1 min-w-0 min-h-12 py-2 flex items-center gap-3 text-left"
                            >
                                <span
                                    className={cn(
                                        "w-6 h-6 shrink-0 rounded-lg border-2 border-border flex items-center justify-center transition-all",
                                        item.completed ? "bg-primary border-primary text-primary-foreground" : "group-hover:border-primary",
                                    )}
                                    aria-hidden
                                >
                                    {item.completed && <Check className="w-4 h-4" />}
                                </span>
                                <span className={cn("flex-1 text-base sm:text-sm font-medium break-words min-w-0", item.completed ? "line-through text-muted-foreground" : "text-foreground")}>
                                    {item.content}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
                                className="hover-reveal w-11 h-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                                aria-label={`${item.content} löschen`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
            {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Noch keine Punkte – leg los!</p>}

            {doneCount > 0 && (
                <button
                    type="button"
                    onClick={() => clearCompletedItems(list.id)}
                    className="w-full min-h-11 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center justify-center gap-2"
                >
                    <Eraser className="w-3.5 h-3.5" />
                    {doneCount} erledigte entfernen
                </button>
            )}
        </div>
    );
}

interface ListEditDialogProps {
    list: ListWithItems | undefined;
    instance?: number;
    /** Liste wurde gerade über "Liste hinzufügen" angelegt */
    created?: boolean;
    onClose: () => void;
}

export function ListEditDialog({ list, instance, created = false, onClose }: ListEditDialogProps) {
    const confirm = useConfirm();
    return (
        <BaseDialog
            isOpen={!!list}
            onClose={onClose}
            title="Liste"
            className="sm:max-w-2xl"
            headerAction={
                list && (
                    <button
                        type="button"
                        onClick={async () => {
                            if (await confirm({ title: `„${list.name}“ löschen?`, message: "Die Liste und alle Punkte werden für alle Mitglieder gelöscht.", confirmLabel: "Löschen", danger: true })) {
                                onClose();
                                await deleteList(list.id);
                            }
                        }}
                        className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                        aria-label="Liste löschen"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )
            }
            footer={
                <button type="button" onClick={onClose} className="w-full btn btn-primary py-3">
                    Fertig
                </button>
            }
        >
            {list && <ListEditor key={`${list.id}:${instance}`} list={list} created={created} />}
        </BaseDialog>
    );
}
