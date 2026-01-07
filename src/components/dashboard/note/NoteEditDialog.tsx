import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { BaseDialog } from "@/components/ui/BaseDialog";

interface NoteEditDialogProps {
    isOpen: boolean;
    note: any;
    setNote: (note: any) => void;
    onClose: () => void;
    onSave: () => void;
    isPending?: boolean;
}

export function NoteEditDialog({ isOpen, note, setNote, onClose, onSave, isPending }: NoteEditDialogProps) {
    const [lastNote, setLastNote] = useState(note);
    useEffect(() => {
        if (note) setLastNote(note);
    }, [note]);

    const activeNote = note || lastNote;

    if (!activeNote) return null;

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Notiz bearbeiten"
            className="sm:max-w-2xl"
            footer={
                <div className="flex gap-3">
                    <button onClick={onSave} disabled={isPending} className="flex-1 btn btn-primary py-3 disabled:opacity-70">
                        {isPending ? <Spinner className="text-primary-foreground" size={20} /> : "Speichern"}
                    </button>
                    <button onClick={onClose} disabled={isPending} className="flex-1 btn btn-ghost py-3">
                        Abbrechen
                    </button>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Titel</label>
                    <input
                        type="text"
                        value={activeNote.title || ""}
                        onChange={(e) => setNote({ ...activeNote, title: e.target.value })}
                        className="w-full text-lg font-black input-field"
                        placeholder="Titel der Notiz"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Inhalt</label>
                    <textarea
                        rows={8}
                        value={activeNote.content || ""}
                        onChange={(e) => setNote({ ...activeNote, content: e.target.value })}
                        className="w-full bg-accent/30 border-2 border-border/30 rounded-xl p-4 outline-none focus:bg-accent/50 focus:border-primary/30 transition-colors resize-none text-sm leading-relaxed"
                        placeholder="Schreibe etwas..."
                    />
                </div>
            </div>
        </BaseDialog>
    );
}
