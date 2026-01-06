"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, UserMinus, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface HouseholdSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    household: any;
    setHousehold: (household: any) => void;
    onRename: () => void;
    onDelete: () => void;
    inviteEmail: string;
    setInviteEmail: (email: string) => void;
    onInvite: (e: React.FormEvent) => void;
    inviteError: string;
    members: any[];
    onRemoveMember: (email: string) => void;
    currentUserEmail?: string;
    isPending?: boolean;
}

export function HouseholdSettingsDialog({
    isOpen,
    onClose,
    household,
    setHousehold,
    onRename,
    onDelete,
    inviteEmail,
    setInviteEmail,
    onInvite,
    inviteError,
    members,
    onRemoveMember,
    currentUserEmail,
    isPending,
}: HouseholdSettingsDialogProps) {
    if (!household) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <div className="space-y-1">
                                <h2 className="text-xl font-black tracking-tight">Haushalt Einstellungen</h2>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                    {household.name}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-full transition-colors"
                                aria-label="Schließen"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Rename Section */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                    Haushalt umbenennen
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={household.name}
                                        onChange={(e) => setHousehold({ ...household, name: e.target.value })}
                                        className="flex-1 bg-accent/20 border-2 border-border/50 rounded-xl px-4 py-3 text-sm outline-none focus:bg-accent/40 focus:border-primary/30 transition-colors"
                                    />
                                    <button
                                        onClick={onRename}
                                        disabled={isPending}
                                        className="btn btn-primary px-6 text-xs uppercase tracking-widest disabled:opacity-70"
                                    >
                                        {isPending ? <Spinner className="text-primary-foreground" /> : "Speichern"}
                                    </button>
                                </div>
                            </div>

                            {/* Members Section */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                    Neues Mitglied einladen
                                </label>
                                <form onSubmit={onInvite} className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="email"
                                            placeholder="email@beispiel.de"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full bg-accent/20 border-2 border-border/50 rounded-xl pl-11 pr-4 py-4 text-sm outline-none focus:bg-accent/40 focus:border-primary/30 transition-colors"
                                        />
                                    </div>
                                    <button type="submit" disabled={isPending} className="btn btn-primary px-8 text-xs disabled:opacity-70">
                                        {isPending ? <Spinner className="text-primary-foreground" /> : "Einladen"}
                                    </button>
                                </form>
                                {inviteError && (
                                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight italic">
                                        {inviteError}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                        Aktuelle Mitglieder
                                    </label>
                                    <span className="text-[10px] font-mono opacity-30">
                                        {members.length} Person(en)
                                    </span>
                                </div>

                                <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                                    {members.map((m, idx) => (
                                        <div
                                            key={idx}
                                            className="flex justify-between items-center p-3 hover:bg-accent/10 transition-colors group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center border border-border">
                                                    <User className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black flex items-center gap-2">
                                                        {m.email}
                                                        {m.role === "OWNER" && (
                                                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest rounded leading-none">
                                                                Inhaber
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {currentUserEmail && m.email !== currentUserEmail && m.role !== "OWNER" && (
                                                <button
                                                    onClick={() => onRemoveMember(m.email)}
                                                    className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="space-y-4 pt-4 border-t border-border">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-red-500">
                                        Gefahrenzone
                                    </label>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        Das Löschen eines Haushalts entfernt alle Zähler, Listen und Notizen
                                        unwiderruflich.
                                    </p>
                                </div>
                                <button
                                    onClick={onDelete}
                                    disabled={isPending}
                                    className="w-full btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-3 text-xs uppercase tracking-widest transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isPending ? <Spinner className="text-red-500" /> : <Trash2 className="w-4 h-4" />}
                                    Haushalt löschen
                                </button>
                            </div>
                        </div>

                        <div className="p-3 border-t border-border bg-accent/10">
                            <button onClick={onClose} className="w-full btn btn-primary py-3">
                                Fertig
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
