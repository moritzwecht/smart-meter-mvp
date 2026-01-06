"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: any;
    profileData: any;
    setProfileData: (data: any) => void;
    profileError: string;
    profileSuccess: boolean;
    onSave: () => void;
    onLogout: () => void;
    isPending?: boolean;
}

export function ProfileDialog({
    isOpen,
    onClose,
    userProfile,
    profileData,
    setProfileData,
    profileError,
    profileSuccess,
    onSave,
    onLogout,
    isPending,
}: ProfileDialogProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-sm bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
                    >
                        <div className="flex justify-between items-center p-3 border-b border-border">
                            <div className="space-y-0.5">
                                <h2 className="text-lg font-black tracking-tight">Profil</h2>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                    {userProfile?.email}
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

                        <div className="p-3 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                        Anzeigename
                                    </label>
                                    <input
                                        type="text"
                                        value={profileData.name}
                                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                        className="w-full input-field"
                                    />
                                </div>

                                <div className="pt-2 border-t border-border/50 space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                        Passwort ändern
                                    </label>
                                    <div className="space-y-2">
                                        <input
                                            type="password"
                                            placeholder="Aktuelles Passwort"
                                            value={profileData.currentPassword}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, currentPassword: e.target.value })
                                            }
                                            className="w-full input-field"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Neues Passwort"
                                            value={profileData.newPassword}
                                            onChange={(e) =>
                                                setProfileData({ ...profileData, newPassword: e.target.value })
                                            }
                                            className="w-full input-field"
                                        />
                                    </div>
                                </div>
                            </div>

                            {profileError && (
                                <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight italic">
                                    {profileError}
                                </p>
                            )}
                            {profileSuccess && (
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">
                                    Erfolgreich gespeichert!
                                </p>
                            )}

                            <div className="pt-2 border-t border-border">
                                <button
                                    onClick={onLogout}
                                    disabled={isPending}
                                    className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {isPending ? <Spinner className="text-red-500" /> : <LogOut className="w-4 h-4" />}
                                    Abmelden
                                </button>
                            </div>
                        </div>

                        <div className="p-3 border-t border-border bg-accent/10 flex gap-2">
                            <button onClick={onSave} disabled={isPending} className="flex-1 btn btn-primary py-3 disabled:opacity-70">
                                {isPending ? <Spinner className="text-primary-foreground" size={20} /> : "Speichern"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
