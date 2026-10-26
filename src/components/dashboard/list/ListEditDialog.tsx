"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Eraser, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { ListWithItems } from "@/lib/offline/hooks";
import { addItem, clearCompletedItems, deleteItem, deleteList, updateItem, updateList } from "@/lib/offline/repo";
import { cn } from "@/lib/utils";

function ListEditor({ list }: { list: ListWithItems }) {
    const [name, setName] = useState(list.name);
    const [newItem, setNewItem] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Name beim Schließen sicher speichern (auch bei ESC / Tippen auf den Hintergrund)
    const pendingName = useRef<string | null>(null);
    useEffect(() => {
        const id = list.id;
        return () => {
            const value = pendingName.current?.trim();
            if (value) void updateList(id, { name: value });
        };
    }, [list.id]);

    const saveName = () => {
        const trimmed = name.trim();
        pendingName.current = null;
        if (trimmed && trimmed !== list.name) void updateList(list.id, { name: trimmed });
        else if (!trimmed) setName(list.name);
    };

    const add = async (e: FormEvent) => {
        e.preventDefault();
        const content = newItem.trim();
        if (!content) return;
        setNewItem("");
        inputRef.current?.focus();
        await addItem(list.id, content);
    };

    const items = [...list.items].sort((a, b) => Number(a.completed) - Number(b.completed));
    const doneCount = list.items.filter((i) => i.completed).length;

    return (
        <div className="space-y-6">
            <input
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

            <form onSubmit={add} className="flex gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Neuer Punkt…"
                    aria-label="Neuer Punkt"
                    maxLength={500}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    enterKeyHint="done"
                    className="flex-1 input-field"
                />
                <button type="submit" disabled={!newItem.trim()} className="btn btn-primary px-5" aria-label="Punkt hinzufügen">
                    <Plus className="w-5 h-5" />
                </button>
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
                            className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl group hover:bg-accent/50 transition-colors"
                        >
                            <button
                                type="button"
                                onClick={() => updateItem(item.id, { completed: !item.completed })}
                                aria-pressed={item.completed}
                                aria-label={item.completed ? `${item.content}: als offen markieren` : `${item.content}: abhaken`}
                                className={cn(
                                    "w-6 h-6 shrink-0 rounded-lg border-2 border-border flex items-center justify-center transition-all",
                                    item.completed ? "bg-primary border-primary text-primary-foreground" : "hover:border-primary",
                                )}
                            >
                                {item.completed && <Check className="w-4 h-4" />}
                            </button>
                            <span className={cn("flex-1 text-sm font-medium break-words min-w-0", item.completed ? "line-through opacity-40" : "text-foreground")}>
                                {item.content}
                            </span>
                            <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
                                className="hover-reveal p-2 -m-1 text-muted-foreground hover:text-red-500 transition-colors"
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
                    className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center justify-center gap-2"
                >
                    <Eraser className="w-3.5 h-3.5" />
                    {doneCount} erledigte entfernen
                </button>
            )}
        </div>
    );
}

export function ListEditDialog({ list, onClose }: { list: ListWithItems | undefined; onClose: () => void }) {
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
            {list && <ListEditor key={list.id} list={list} />}
        </BaseDialog>
    );
}
