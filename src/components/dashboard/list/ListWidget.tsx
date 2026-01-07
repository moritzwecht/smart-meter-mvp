"use client";

import { useOptimistic, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListTodo, Check, Edit2, Trash2, Pin } from "lucide-react";

interface ListWidgetProps {
    list: any;
    onEdit: (list: any) => void;
    onPin?: () => void;
}

export function ListWidget({ list, onEdit, onPin }: ListWidgetProps) {
    const [optimisticList] = useOptimistic(
        list,
        (state, action: { type: "toggle" | "add"; payload: any }) => {
            switch (action.type) {
                case "toggle":
                    return {
                        ...state,
                        items: state.items?.map((item: any) =>
                            item.id === action.payload.itemId ? { ...item, completed: action.payload.completed } : item
                        ),
                    };
                default:
                    return state;
            }
        }
    );

    return (
        <div
            onClick={() => onEdit(optimisticList)}
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 shadow-sm hover:border-primary/50 transition-all cursor-pointer"
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-1.5 p-1.5 bg-accent rounded-lg shrink-0">
                        <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-1">
                            {list.name}
                        </h3>
                    </div>
                </div>
                {onPin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPin();
                        }}
                        className={`p-1.5 rounded-lg shrink-0 ${list.isPinned === "true"
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground/30 hover:text-primary hover:bg-primary/5"
                            }`}
                    >
                        <Pin className={`w-3.5 h-3.5 ${list.isPinned === "true" ? "fill-current" : ""}`} />
                    </button>
                )}
            </div>
            <div className="mt-3 space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
                    {[...(optimisticList.items || [])]
                        .sort((a, b) => {
                            if (a.completed === b.completed) return 0;
                            return a.completed === "true" ? 1 : -1;
                        })
                        .slice(0, 3)
                        .map((item: any) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{
                                    layout: { duration: 0.3, type: "spring", stiffness: 300, damping: 30 },
                                    opacity: { duration: 0.2 }
                                }}
                            >
                                <div
                                    className="text-xs flex items-center gap-3 w-full text-left group/item p-1 -m-1 rounded-md transition-colors"
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
                                </div>
                            </motion.div>
                        ))}
                </AnimatePresence>
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
    );
}
