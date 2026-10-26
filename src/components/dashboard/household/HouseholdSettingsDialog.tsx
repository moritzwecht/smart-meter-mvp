"use client";

import { Copy, Crown, LogOut, Mail, Trash2, User, UserMinus, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
    deleteHousehold,
    getHouseholdDetails,
    inviteMember,
    leaveHousehold,
    promoteMember,
    removeMember,
    renameHousehold,
    revokeInvite,
    type HouseholdMember,
    type PendingInvite,
} from "@/app/actions/households";
import { FieldLabel } from "@/components/ui/AddTile";
import { Alert } from "@/components/ui/Alert";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/client-actions";
import { formatDate } from "@/lib/meter/format";
import { db } from "@/lib/offline/db";
import { requestSync } from "@/lib/offline/sync-engine";
import type { Household, Role } from "@/lib/sync/types";

interface Details {
    role: Role;
    members: HouseholdMember[];
    invites: PendingInvite[];
}

async function copy(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

function HouseholdSettings({ household, onClose }: { household: Household; onClose: () => void }) {
    const toast = useToast();
    const confirm = useConfirm();
    const [details, setDetails] = useState<Details | null>(null);
    const [loadError, setLoadError] = useState("");
    const [name, setName] = useState(household.name);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        const result = await runAction(() => getHouseholdDetails({ householdId: household.id }));
        if (result.ok) {
            setDetails(result.data);
            setLoadError("");
        } else setLoadError(result.error);
    }, [household.id]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten werden beim Öffnen vom Server geladen
        void load();
    }, [load]);

    const isOwner = (details?.role ?? household.role) === "OWNER";

    async function run<T>(key: string, call: () => Promise<ActionResult<T>>, success?: string): Promise<T | undefined> {
        setBusy(key);
        const result = await runAction(call);
        setBusy(null);
        if (!result.ok) {
            toast({ message: result.error, variant: "error" });
            return undefined;
        }
        if (success) toast({ message: success, variant: "success" });
        return result.data;
    }

    const rename = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || name.trim() === household.name) return;
        const ok = await run("rename", () => renameHousehold({ householdId: household.id, name }), "Haushalt umbenannt");
        if (ok !== undefined) {
            await db.households.update(household.id, { name: name.trim() });
            requestSync();
        }
    };

    const invite = async (e: FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        const data = await run("invite", () => inviteMember({ householdId: household.id, email: inviteEmail }));
        if (!data) return;
        setInviteEmail("");
        setInviteLink(data.link);
        toast({
            message: data.emailSent ? "Einladung per E-Mail verschickt." : "Einladung erstellt – teile den Link selbst.",
            variant: "success",
        });
        await load();
    };

    const leaveOrDelete = async (kind: "leave" | "delete") => {
        const ok = await confirm(
            kind === "delete"
                ? {
                      title: `„${household.name}“ löschen?`,
                      message: "Alle Zähler, Ablesungen, Listen und Notizen werden für alle Mitglieder unwiderruflich gelöscht.",
                      confirmLabel: "Endgültig löschen",
                      danger: true,
                  }
                : { title: `„${household.name}“ verlassen?`, message: "Du verlierst den Zugriff, bis dich jemand erneut einlädt.", confirmLabel: "Verlassen", danger: true },
        );
        if (!ok) return;
        const done = await run(kind, () => (kind === "delete" ? deleteHousehold({ householdId: household.id }) : leaveHousehold({ householdId: household.id })));
        if (done === undefined) return;
        onClose();
        requestSync({ immediate: true }); // entfernt den Haushalt samt Daten lokal
    };

    return (
        <div className="space-y-8">
            {loadError && (
                <Alert variant="warning">
                    {loadError} Mitglieder und Einladungen lassen sich nur online verwalten.
                </Alert>
            )}

            {isOwner && (
                <form onSubmit={rename} className="space-y-2">
                    <FieldLabel htmlFor="household-name">Name</FieldLabel>
                    <div className="flex gap-2">
                        <input id="household-name" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-0 input-field" />
                        <button type="submit" disabled={busy === "rename" || !name.trim() || name.trim() === household.name} className="btn btn-primary px-5 text-xs uppercase tracking-widest">
                            {busy === "rename" ? <Spinner className="text-primary-foreground" /> : "Speichern"}
                        </button>
                    </div>
                </form>
            )}

            <section className="space-y-3">
                <div className="flex justify-between items-center">
                    <FieldLabel>Mitglieder</FieldLabel>
                    {details && <span className="text-[10px] font-mono text-muted-foreground">{details.members.length} Person(en)</span>}
                </div>
                {!details && !loadError && (
                    <div className="flex justify-center py-6">
                        <Spinner size={20} />
                    </div>
                )}
                {details && (
                    <ul className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                        {details.members.map((m) => (
                            <li key={m.userId} className="flex justify-between items-center gap-3 p-3 group">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 shrink-0 rounded-full bg-accent flex items-center justify-center border border-border">
                                        <User className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black flex items-center gap-2">
                                            <span className="truncate">{m.name}</span>
                                            {m.isYou && <span className="text-[9px] font-bold text-muted-foreground uppercase">Du</span>}
                                            {m.role === "OWNER" && (
                                                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest rounded leading-none">Inhaber</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                                    </div>
                                </div>
                                {isOwner && !m.isYou && m.role === "MEMBER" && (
                                    <div className="flex shrink-0">
                                        <button
                                            type="button"
                                            disabled={!!busy}
                                            onClick={async () => {
                                                if (await confirm({ title: `${m.name} zum Inhaber machen?`, message: "Inhaber können Mitglieder verwalten, umbenennen und den Haushalt löschen.", confirmLabel: "Zum Inhaber machen" })) {
                                                    if ((await run("promote", () => promoteMember({ householdId: household.id, userId: m.userId }), `${m.name} ist jetzt Inhaber`)) !== undefined) await load();
                                                }
                                            }}
                                            className="hover-reveal p-2 text-muted-foreground hover:text-primary"
                                            aria-label={`${m.name} zum Inhaber machen`}
                                        >
                                            <Crown className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!!busy}
                                            onClick={async () => {
                                                if (await confirm({ title: `${m.name} entfernen?`, confirmLabel: "Entfernen", danger: true })) {
                                                    if ((await run("remove", () => removeMember({ householdId: household.id, userId: m.userId }), `${m.name} entfernt`)) !== undefined) await load();
                                                }
                                            }}
                                            className="hover-reveal p-2 text-muted-foreground hover:text-red-500"
                                            aria-label={`${m.name} entfernen`}
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {isOwner && details && (
                <section className="space-y-3">
                    <FieldLabel htmlFor="invite-email">Jemanden einladen</FieldLabel>
                    <form onSubmit={invite} className="flex gap-2">
                        <input
                            id="invite-email"
                            type="email"
                            inputMode="email"
                            autoComplete="off"
                            placeholder="email@beispiel.de"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="flex-1 min-w-0 input-field"
                        />
                        <button type="submit" disabled={busy === "invite" || !inviteEmail.trim()} className="btn btn-primary px-5 text-xs">
                            {busy === "invite" ? <Spinner className="text-primary-foreground" /> : <Mail className="w-4 h-4" />}
                            Einladen
                        </button>
                    </form>
                    {inviteLink && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/40 text-xs">
                            <span className="flex-1 truncate font-mono">{inviteLink}</span>
                            <button
                                type="button"
                                onClick={async () => toast((await copy(inviteLink)) ? { message: "Link kopiert", variant: "success" } : "Kopieren nicht möglich")}
                                className="btn btn-secondary px-3 py-1.5 text-xs"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Kopieren
                            </button>
                        </div>
                    )}
                    {details.invites.length > 0 && (
                        <ul className="space-y-1">
                            {details.invites.map((inv) => (
                                <li key={inv.id} className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl border border-dashed border-border">
                                    <span className="truncate">
                                        {inv.email} <span className="text-muted-foreground">· offen bis {formatDate(inv.expiresAt)}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if ((await run("revoke", () => revokeInvite({ householdId: household.id, inviteId: inv.id }))) !== undefined) await load();
                                        }}
                                        className="p-1 text-muted-foreground hover:text-red-500"
                                        aria-label={`Einladung an ${inv.email} zurückziehen`}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            <section className="space-y-3 pt-4 border-t border-border">
                <FieldLabel className="text-red-500">Gefahrenzone</FieldLabel>
                <div className="flex flex-col sm:flex-row gap-2">
                    <button type="button" onClick={() => leaveOrDelete("leave")} disabled={!!busy} className="flex-1 btn btn-danger py-3 text-xs uppercase tracking-widest">
                        <LogOut className="w-4 h-4" />
                        Verlassen
                    </button>
                    {isOwner && (
                        <button type="button" onClick={() => leaveOrDelete("delete")} disabled={!!busy} className="flex-1 btn btn-danger py-3 text-xs uppercase tracking-widest">
                            <Trash2 className="w-4 h-4" />
                            Haushalt löschen
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
}

export function HouseholdSettingsDialog({ household, onClose }: { household: Household | undefined; onClose: () => void }) {
    return (
        <BaseDialog isOpen={!!household} onClose={onClose} title={household?.name} className="sm:max-w-xl">
            {household && <HouseholdSettings key={household.id} household={household} onClose={onClose} />}
        </BaseDialog>
    );
}
