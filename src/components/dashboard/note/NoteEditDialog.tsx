import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { BaseDialog } from "@/components/ui/BaseDialog";

interface NoteEditDialogProps {
    isOpen: boolean;
    note: any;
    setNote: (note: any) => void;
    onClose: () => void;
    onSave: () => void;
    onDelete: (id: number) => void;
    isPending?: boolean;
}

export function NoteEditDialog({
    isOpen,
    note,
    setNote,
    onClose,
    onSave,
    onDelete,
    isPending
}: NoteEditDialogProps) {
    const [lastNote, setLastNote] = useState(note);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (note) {
            setLastNote(note);

            // Auto-save logic
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                onSave();
            }, 1000);
        }

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [note?.title, note?.content, onSave]);

    const activeNote = note || lastNote;

    if (!activeNote) return null;

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Notiz bearbeiten"
            className="sm:max-w-2xl"
            headerAction={
                <button
                    onClick={() => {
                        if (window.confirm("Notiz wirklich löschen?")) {
                            onDelete(activeNote.id);
                            onClose();
                        }
                    }}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            }
            footer={
                <button onClick={onClose} className="w-full btn btn-primary py-3">
                    Fertig
                </button>
            }
        >
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Titel</label>
                        {isPending && <span className="text-[10px] font-bold text-primary animate-pulse uppercase tracking-widest">Speichert...</span>}
                    </div>
                    <input
                        type="text"
                        value={activeNote.title || ""}
                        onChange={(e) => setNote({ ...activeNote, title: e.target.value })}
                        className="w-full text-lg font-black input-field"
                        placeholder="Titel der Notiz"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Inhalt</label>
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
