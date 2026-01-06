"use client";

import { motion } from "framer-motion";
import { ListTodo, Check, Edit2, Trash2 } from "lucide-react";

interface ListWidgetProps {
    list: any;
    onEdit: (list: any) => void;
    onDelete: (id: number) => void;
}

export function ListWidget({ list, onEdit, onDelete }: ListWidgetProps) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileTap={{ scale: 0.98 }}
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-foreground/5"
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 px-2 py-1 bg-accent rounded-md text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <ListTodo className="w-3 h-3" />
                    LIST
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
                    {list.items?.slice(0, 3).map((item: any) => (
                        <div key={item.id} className="text-xs flex items-center gap-3">
                            <div
                                className={`w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 ${item.completed === "true" ? "bg-primary text-primary-foreground border-primary" : ""
                                    } `}
                            >
                                {item.completed === "true" && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span
                                className={`line-clamp-1 ${item.completed === "true" ? "line-through opacity-40" : "text-foreground/80"
                                    } `}
                            >
                                {item.content}
                            </span>
                        </div>
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
        </motion.div>
    );
}
