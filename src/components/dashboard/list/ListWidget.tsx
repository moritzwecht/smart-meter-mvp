"use client";

import { useOptimistic, useTransition } from "react";
import { motion } from "framer-motion";
import { ListTodo, Check, Edit2, Trash2, Pin } from "lucide-react";

interface ListWidgetProps {
    list: any;
    onEdit: (list: any) => void;
    onDelete: (id: number) => void;
    onToggleItem: (id: number, status: "true" | "false") => void;
    onPin?: () => void;
}

export function ListWidget({ list, onEdit, onDelete, onToggleItem, onPin }: ListWidgetProps) {
    const [isPending, startTransition] = useTransition();
    const [optimisticList, addOptimisticToggle] = useOptimistic(
        list,
        (state, { itemId, completed }) => ({
            ...state,
            items: state.items?.map((item: any) =>
                item.id === itemId ? { ...item, completed } : item
            ),
        })
    );

    return (
        <div
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 shadow-sm"
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2 py-1 bg-accent rounded-md text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <ListTodo className="w-3 h-3" />
                        LIST
                    </div>
                    {onPin && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPin();
                            }}
                            className={`p-1.5 rounded-lg ${list.isPinned === "true"
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground/30 hover:text-primary hover:bg-primary/5"
                                }`}
                        >
                            <Pin className={`w-3 h-3 ${list.isPinned === "true" ? "fill-current" : ""}`} />
                        </button>
                    )}
                </div>
                <div className="text-[10px] font-mono opacity-30 uppercase">
                    {new Date(list.createdAt).toLocaleDateString()}
                </div>
            </div>

            <div className="flex-1">
                <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-1">
                    {list.name}
                </h3>
                <div className="mt-3 space-y-2">
                    {optimisticList.items?.slice(0, 3).map((item: any) => (
                        <button
                            key={item.id}
                            disabled={isPending}
                            onClick={(e) => {
                                e.stopPropagation();
                                const newStatus = item.completed === "true" ? "false" : "true";
                                startTransition(async () => {
                                    addOptimisticToggle({ itemId: item.id, completed: newStatus });
                                    await onToggleItem(item.id, newStatus);
                                });
                            }}
                            className="text-xs flex items-center gap-3 w-full text-left group/item hover:bg-accent/30 p-1 -m-1 rounded-md transition-colors"
                        >
                            <div
                                className={`w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 transition-colors ${item.completed === "true" ? "bg-primary text-primary-foreground border-primary" : "group-hover/item:border-primary/50"
                                    } `}
                            >
                                {item.completed === "true" && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span
                                className={`line-clamp-1 transition-all ${item.completed === "true" ? "line-through opacity-40 text-muted-foreground" : "text-foreground/80"
                                    } `}
                            >
                                {item.content}
                            </span>
                        </button>
                    ))}
                    {list.items?.length > 3 && (
                        <div className="text-[10px] text-muted-foreground mt-2 font-medium">
                            +{list.items.length - 3} weitere Punkte
                        </div>
                    )}
                    {(!list.items || list.items.length === 0) && (
                        <p className="text-xs text-muted-foreground/50 italic">Keine Punkte vorhanden</p>
                    )}
                </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-between items-center bg-card">
                <button
                    onClick={() => onEdit(list)}
                    className="btn btn-ghost px-2 py-1 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                >
                    <Edit2 className="w-3 h-3" />
                    Bearbeiten
                </button>
                <button
                    onClick={() => onDelete(list.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
