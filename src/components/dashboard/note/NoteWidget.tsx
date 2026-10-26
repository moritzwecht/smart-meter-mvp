"use client";

import { FileText, Pin } from "lucide-react";
import { memo } from "react";
import type { Note } from "@/lib/sync/types";
import { cn } from "@/lib/utils";

interface NoteWidgetProps {
    note: Note;
    onOpen: (noteId: string) => void;
    onTogglePin: (noteId: string, pinned: boolean) => void;
}

export const NoteWidget = memo(function NoteWidget({ note, onOpen, onTogglePin }: NoteWidgetProps) {
    return (
        <div className="bg-card text-card-foreground rounded-lg border border-border flex p-3 gap-3 shadow-sm hover:border-primary/50 transition-colors">
            <button type="button" onClick={() => onOpen(note.id)} className="flex items-start gap-2.5 min-w-0 flex-1 text-left">
                <div className="mt-1.5 p-1.5 bg-accent rounded-lg shrink-0">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                    <h3 className={cn("text-xl font-black tracking-tight line-clamp-1", !note.title && "text-muted-foreground")}>{note.title || "Ohne Titel"}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3 leading-relaxed whitespace-pre-line break-words">{note.content || "Kein Inhalt …"}</p>
                </div>
            </button>
            <button
                type="button"
                onClick={() => onTogglePin(note.id, !note.isPinned)}
                aria-pressed={note.isPinned}
                aria-label={note.isPinned ? "Vom Dashboard lösen" : "Ans Dashboard heften"}
                className={cn(
                    "p-1.5 h-fit rounded-lg shrink-0",
                    note.isPinned ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/5",
                )}
            >
                <Pin className={cn("w-3.5 h-3.5", note.isPinned && "fill-current")} />
            </button>
        </div>
    );
});
