import { useState, useEffect } from "react";
import { Mail, User, UserMinus, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { BaseDialog } from "@/components/ui/BaseDialog";

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
    const [lastHousehold, setLastHousehold] = useState(household);
    useEffect(() => {
        if (household) setLastHousehold(household);
    }, [household]);

    const activeHousehold = household || lastHousehold;

    if (!activeHousehold) return null;

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Haushalt Einstellungen"
            className="sm:max-w-xl"
            footer={
                <button onClick={onClose} className="w-full btn btn-primary py-3">
                    Fertig
                </button>
            }
        >
            <div className="space-y-8">
                {/* Rename Section */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                        Haushalt umbenennen
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={activeHousehold.name}
                            onChange={(e) => setHousehold({ ...activeHousehold, name: e.target.value })}
                            className="flex-1 input-field"
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
                            <input
                                type="email"
                                placeholder="email@beispiel.de"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="w-full input-field"
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
        </BaseDialog>
    );
}
