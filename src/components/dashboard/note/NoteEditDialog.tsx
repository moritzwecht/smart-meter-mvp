"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FieldLabel } from "@/components/ui/AddTile";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { deleteNote, updateNote } from "@/lib/offline/repo";
import type { Note } from "@/lib/sync/types";

const AUTOSAVE_MS = 600;

/*
 * Autosave: Änderungen landen nach kurzer Pause lokal (und damit in der Outbox,
 * wo mehrere Updates zu einem zusammengeführt werden). Beim Schließen wird sofort
 * gespeichert. Nach dem Löschen läuft kein verspäteter Speichervorgang mehr –
 * der hatte in Version 1 den kompletten Sync blockiert.
 */
function NoteEditor({ note }: { note: Note }) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content ?? "");
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const dirty = useRef<{ title: string; content: string } | null>(null);

    const flush = useCallback(() => {
        clearTimeout(timer.current);
        const pending = dirty.current;
        dirty.current = null;
        if (pending) void updateNote(note.id, { title: pending.title, content: pending.content || null });
    }, [note.id]);

    useEffect(() => flush, [flush]); // beim Schließen speichern

    const change = (next: { title: string; content: string }) => {
        setTitle(next.title);
        setContent(next.content);
        dirty.current = next;
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, AUTOSAVE_MS);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <FieldLabel htmlFor="note-title">Titel</FieldLabel>
                <input
                    id="note-title"
                    type="text"
                    value={title}
                    maxLength={200}
                    onChange={(e) => change({ title: e.target.value, content })}
                    className="w-full text-lg font-black input-field"
                    placeholder="Titel der Notiz"
                />
            </div>
            <div className="space-y-2">
                <FieldLabel htmlFor="note-content">Inhalt</FieldLabel>
                <textarea
                    id="note-content"
                    rows={10}
                    value={content}
                    onChange={(e) => change({ title, content: e.target.value })}
                    className="w-full input-field resize-y min-h-40 leading-relaxed"
                    placeholder="Schreibe etwas …"
                />
            </div>
        </div>
    );
}

export function NoteEditDialog({ note, onClose }: { note: Note | undefined; onClose: () => void }) {
    const confirm = useConfirm();
    return (
        <BaseDialog
            isOpen={!!note}
            onClose={onClose}
            title="Notiz"
            className="sm:max-w-2xl"
            headerAction={
                note && (
                    <button
                        type="button"
                        onClick={async () => {
                            if (await confirm({ title: "Notiz löschen?", message: note.title || undefined, confirmLabel: "Löschen", danger: true })) {
                                onClose();
                                await deleteNote(note.id);
                            }
                        }}
                        className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                        aria-label="Notiz löschen"
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
            {note && <NoteEditor key={note.id} note={note} />}
        </BaseDialog>
    );
}
