import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { BaseDialog } from "@/components/ui/BaseDialog";

interface NoteEditDialogProps {
    isOpen: boolean;
    note: any;
    setNote: (note: any) => void;
    onClose: () => void;
    onSave: (title: string, content: string) => void;
    onDelete: (id: number) => void;
    isPending?: boolean;
}

export function NoteEditDialog({
    isOpen,
    note: noteProp,
    setNote,
    onClose,
    onSave,
    onDelete,
    isPending
}: NoteEditDialogProps) {
    const [localTitle, setLocalTitle] = useState("");
    const [localContent, setLocalContent] = useState("");
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dbSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Preserve note for exit animations or while loading
    const [lastNote, setLastNote] = useState(noteProp);
    useEffect(() => {
        if (noteProp) setLastNote(noteProp);
    }, [noteProp]);

    const note = noteProp || lastNote;

    // Sync from prop to local state only when dialog opens or ID changes
    useEffect(() => {
        if (isOpen && note) {
            setLocalTitle(note.title || "");
            setLocalContent(note.content || "");
        }
    }, [isOpen, note?.id]);

    // Helper to flush current local state to parent/DB
    const flushChanges = () => {
        if (dbSyncTimeoutRef.current) clearTimeout(dbSyncTimeoutRef.current);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        if (note) {
            // Update parent (local DB)
            setNote({ ...note, title: localTitle, content: localContent });
            // Update server (via explicit values to avoid stale parent state)
            onSave(localTitle, localContent);
        }
    };

    const handleClose = () => {
        flushChanges();
        onClose();
    };

    // Handle title change
    const handleTitleChange = (val: string) => {
        setLocalTitle(val);
        // Debounce sync to local DB (for instant dashboard update)
        if (dbSyncTimeoutRef.current) clearTimeout(dbSyncTimeoutRef.current);
        dbSyncTimeoutRef.current = setTimeout(() => {
            if (note) setNote({ ...note, title: val, content: localContent });
        }, 300);

        // Debounce sync to server (auto-save)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            onSave(val, localContent);
        }, 1000);
    };

    // Handle content change
    const handleContentChange = (val: string) => {
        setLocalContent(val);
        // Debounce sync to local DB (for instant dashboard update)
        if (dbSyncTimeoutRef.current) clearTimeout(dbSyncTimeoutRef.current);
        dbSyncTimeoutRef.current = setTimeout(() => {
            if (note) setNote({ ...note, title: localTitle, content: val });
        }, 300);

        // Debounce sync to server (auto-save)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            onSave(localTitle, val);
        }, 1000);
    };

    if (!isOpen || !note) return null;

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={handleClose}
            title="Notiz bearbeiten"
            className="sm:max-w-2xl"
            headerAction={
                <button
                    onClick={() => {
                        if (window.confirm("Notiz wirklich löschen?")) {
                            onDelete(note.id);
                            onClose();
                        }
                    }}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            }
            footer={
                <button onClick={handleClose} className="w-full btn btn-primary py-3">
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
                        value={localTitle}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        className="w-full text-lg font-black input-field"
                        placeholder="Titel der Notiz"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Inhalt</label>
                    <textarea
                        rows={8}
                        value={localContent}
                        onChange={(e) => handleContentChange(e.target.value)}
                        className="w-full bg-accent/30 border-2 border-border/30 rounded-xl p-4 outline-none focus:bg-accent/50 focus:border-primary/30 transition-colors resize-none text-sm leading-relaxed"
                        placeholder="Schreibe etwas..."
                    />
                </div>
            </div>
        </BaseDialog>
    );
}
