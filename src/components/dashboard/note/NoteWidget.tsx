"use client";

import { motion } from "framer-motion";
import { FileText, Edit2, Trash2, Pin } from "lucide-react";

interface NoteWidgetProps {
    note: any;
    onEdit: (note: any) => void;
    onPin?: () => void;
}

export function NoteWidget({ note, onEdit, onPin }: NoteWidgetProps) {
    return (
        <div
            onClick={() => onEdit(note)}
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 shadow-sm hover:border-primary/50 transition-all cursor-pointer"
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-1.5 p-1.5 bg-accent rounded-lg shrink-0">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-1">
                            {note.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                            {note.content || "Kein Inhalt..."}
                        </p>
                    </div>
                </div>
                {onPin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPin();
                        }}
                        className={`p-1.5 rounded-lg shrink-0 ${note.isPinned === "true"
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground/30 hover:text-primary hover:bg-primary/5"
                            }`}
                    >
                        <Pin className={`w-3.5 h-3.5 ${note.isPinned === "true" ? "fill-current" : ""}`} />
                    </button>
                )}
            </div>
        </div>
    );
}
