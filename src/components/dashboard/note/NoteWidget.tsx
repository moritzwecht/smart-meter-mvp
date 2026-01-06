"use client";

import { motion } from "framer-motion";
import { FileText, Edit2, Trash2, Pin } from "lucide-react";

interface NoteWidgetProps {
    note: any;
    onEdit: (note: any) => void;
    onDelete: (id: number) => void;
    onPin?: () => void;
}

export function NoteWidget({ note, onEdit, onDelete, onPin }: NoteWidgetProps) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-foreground/5"
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2 py-1 bg-accent rounded-md text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        NOTE
                    </div>
                    {onPin && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPin();
                            }}
                            className={`p-1.5 rounded-lg transition-all duration-300 ${note.isPinned === "true"
                                    ? "text-primary bg-primary/10"
                                    : "text-muted-foreground/30 hover:text-primary hover:bg-primary/5"
                                }`}
                        >
                            <Pin className={`w-3 h-3 ${note.isPinned === "true" ? "fill-current" : ""}`} />
                        </button>
                    )}
                </div>
                <div className="text-[10px] font-mono opacity-30 uppercase">
                    {new Date(note.createdAt).toLocaleDateString()}
                </div>
            </div>

            <div className="flex-1">
                <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-1">
                    {note.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                    {note.content || "Kein Inhalt..."}
                </p>
            </div>

            <div className="pt-3 border-t border-border flex justify-between items-center bg-card">
                <button
                    onClick={() => onEdit(note)}
                    className="btn btn-ghost px-2 py-1 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                >
                    <Edit2 className="w-3 h-3" />
                    Bearbeiten
                </button>
                <button
                    onClick={() => onDelete(note.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
