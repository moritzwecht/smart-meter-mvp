"use client";

import { useOptimistic, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash2, Plus } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface ListEditDialogProps {
    isOpen: boolean;
    list: any;
    setList: (list: any) => void;
    onClose: () => void;
    onUpdateList: (id: number, name: string) => void;
    onAddItem: (content: string) => void;
    onToggleItem: (id: number, status: "true" | "false") => void;
    onDeleteItem: (id: number) => void;
    newItemValue: string;
    setNewItemValue: (val: string) => void;
    isPending?: boolean;
}

export function ListEditDialog({
    isOpen,
    list,
    setList,
    onClose,
    onUpdateList,
    onAddItem,
    onToggleItem,
    onDeleteItem,
    newItemValue,
    setNewItemValue,
    isPending: parentIsPending,
}: ListEditDialogProps) {
    const [isTransitionPending, startTransition] = useTransition();
    const isPending = parentIsPending || isTransitionPending;

    const [optimisticList, addOptimisticAction] = useOptimistic(
        list,
        (state, action: { type: "toggle" | "add" | "delete"; payload: any }) => {
            switch (action.type) {
                case "toggle":
                    return {
                        ...state,
                        items: state.items?.map((item: any) =>
                            item.id === action.payload.id
                                ? { ...item, completed: action.payload.status }
                                : item
                        ),
                    };
                case "add":
                    return {
                        ...state,
                        items: [
                            ...(state.items || []),
                            {
                                id: Math.random(), // Temporary ID
                                content: action.payload.content,
                                completed: "false",
                            },
                        ],
                    };
                case "delete":
                    return {
                        ...state,
                        items: state.items?.filter((item: any) => item.id !== action.payload.id),
                    };
                default:
                    return state;
            }
        }
    );

    if (!list) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="flex justify-between items-center p-3 border-b border-border">
                            <h2 className="text-xl font-black tracking-tight">Liste bearbeiten</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-full transition-colors"
                                aria-label="Schließen"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                    Name der Liste
                                </label>
                                <input
                                    type="text"
                                    value={list.name}
                                    onChange={(e) => setList({ ...list, name: e.target.value })}
                                    onBlur={() => onUpdateList(list.id, list.name)}
                                    className="w-full text-2xl font-black bg-transparent border-none focus:ring-0 p-0 outline-none"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                    Listenpunkte
                                </label>

                                <div className="space-y-2">
                                    <AnimatePresence mode="popLayout">
                                        {optimisticList.items?.map((item: any) => (
                                            <motion.div
                                                key={item.id}
                                                layout
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl group transition-colors hover:bg-accent/50"
                                            >
                                                <button
                                                    onClick={() => {
                                                        const newStatus = item.completed === "true" ? "false" : "true";
                                                        startTransition(async () => {
                                                            addOptimisticAction({ type: "toggle", payload: { id: item.id, status: newStatus } });
                                                            await onToggleItem(item.id, newStatus);
                                                        });
                                                    }}
                                                    className={`w-6 h-6 rounded-lg border-2 border-border flex items-center justify-center transition-all ${item.completed === "true"
                                                        ? "bg-primary border-primary text-primary-foreground transform scale-105"
                                                        : "hover:border-primary"
                                                        } `}
                                                >
                                                    {item.completed === "true" && <Check className="w-4 h-4" />}
                                                </button>
                                                <span
                                                    className={`flex-1 text-sm font-medium ${item.completed === "true" ? "line-through opacity-40" : "text-foreground"
                                                        } `}
                                                >
                                                    {item.content}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        startTransition(async () => {
                                                            addOptimisticAction({ type: "delete", payload: { id: item.id } });
                                                            await onDeleteItem(item.id);
                                                        });
                                                    }}
                                                    className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if (!newItemValue.trim()) return;
                                            startTransition(async () => {
                                                addOptimisticAction({ type: "add", payload: { content: newItemValue } });
                                                await onAddItem(newItemValue);
                                            });
                                        }}
                                        className="flex gap-2 mt-4"
                                    >
                                        <input
                                            type="text"
                                            placeholder="Neuer Punkt..."
                                            value={newItemValue}
                                            onChange={(e) => setNewItemValue(e.target.value)}
                                            className="flex-1 bg-accent/20 rounded-xl px-4 py-3 text-sm outline-none focus:bg-accent/40 transition-colors"
                                        />
                                        <button type="submit" disabled={isPending} className="btn btn-primary px-6 disabled:opacity-70">
                                            {isPending ? <Spinner className="text-primary-foreground" /> : <Plus className="w-5 h-5" />}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 border-t border-border bg-accent/10">
                            <button onClick={onClose} className="w-full btn btn-primary py-3">
                                Fertig
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
