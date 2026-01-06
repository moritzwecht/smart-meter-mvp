"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface NoteEditDialogProps {
    isOpen: boolean;
    note: any;
    setNote: (note: any) => void;
    onClose: () => void;
    onSave: () => void;
    isPending?: boolean;
}

export function NoteEditDialog({ isOpen, note, setNote, onClose, onSave, isPending }: NoteEditDialogProps) {
    if (!note) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
                    >
                        <div className="flex justify-between items-center p-3 border-b border-border">
                            <h2 className="text-xl font-black tracking-tight">Notiz bearbeiten</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-full transition-colors"
                                aria-label="Schließen"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 space-y-6 overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Titel</label>
                                <input
                                    type="text"
                                    value={note.title}
                                    onChange={(e) => setNote({ ...note, title: e.target.value })}
                                    className="w-full text-lg font-black input-field"
                                    placeholder="Titel der Notiz"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Inhalt</label>
                                <textarea
                                    rows={8}
                                    value={note.content || ""}
                                    onChange={(e) => setNote({ ...note, content: e.target.value })}
                                    className="w-full bg-accent/30 border-2 border-border/30 rounded-xl p-4 outline-none focus:bg-accent/50 focus:border-primary/30 transition-colors resize-none text-sm leading-relaxed"
                                    placeholder="Schreibe etwas..."
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-accent/20 border-t border-border flex gap-3">
                            <button onClick={onSave} disabled={isPending} className="flex-1 btn btn-primary py-3 disabled:opacity-70">
                                {isPending ? <Spinner className="text-primary-foreground" size={20} /> : "Speichern"}
                            </button>
                            <button onClick={onClose} disabled={isPending} className="flex-1 btn btn-ghost py-3">
                                Abbrechen
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
