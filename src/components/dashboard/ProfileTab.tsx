"use client";

import { LogOut, Mail, MonitorSmartphone, Moon, Shield, Sun, User } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { logout, logoutEverywhere } from "@/app/actions/auth";
import { updateName } from "@/app/actions/profile";
import { APP_VERSION } from "@/components/auth/AuthScreen";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { runAction } from "@/lib/client-actions";
import { usePendingCount, useSyncState } from "@/lib/offline/hooks";
import { signedOut, updateCachedUser } from "@/lib/offline/session";
import type { SessionUser } from "@/lib/sync/types";
import { formatDateTime } from "@/lib/meter/format";
import { useTheme } from "@/lib/theme";
import { ApiSection } from "./profile/ApiSection";
import { ReminderSection } from "./profile/ReminderSection";

function NameForm({ user }: { user: SessionUser }) {
    const toast = useToast();
    const [name, setName] = useState(user.name);
    const [saving, setSaving] = useState(false);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await runAction(() => updateName({ name }));
        setSaving(false);
        if (!result.ok) return toast({ message: result.error, variant: "error" });
        await updateCachedUser({ name: result.data.name });
        toast({ message: "Name gespeichert", variant: "success" });
    };
    return (
        <form onSubmit={submit} className="space-y-3">
            <Input label="Anzeigename" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" />
            <Button type="submit" variant="ghost" disabled={saving || !name.trim() || name === user.name} className="w-full border-2 border-border">
                {saving ? <Spinner /> : "Name speichern"}
            </Button>
        </form>
    );
}

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <div className="py-3 px-4 bg-accent/20 border-2 border-border/50 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-muted-foreground">{icon}</span>
                <span className="text-sm font-medium truncate">{title}</span>
            </div>
            {children}
        </div>
    );
}

export function ProfileTab({ user }: { user: SessionUser }) {
    const toast = useToast();
    const confirm = useConfirm();
    const { theme, setTheme } = useTheme();
    const pending = usePendingCount();
    const { lastSyncedAt } = useSyncState();
    const [busy, setBusy] = useState(false);

    const signOut = async () => {
        const ok = await confirm(
            pending > 0
                ? {
                      title: "Trotzdem abmelden?",
                      message: `${pending} Änderung${pending === 1 ? " ist" : "en sind"} noch nicht synchronisiert und ${pending === 1 ? "würde" : "würden"} verloren gehen.`,
                      confirmLabel: "Abmelden",
                      danger: true,
                  }
                : { title: "Abmelden?", message: "Die lokal gespeicherten Daten werden von diesem Gerät entfernt.", confirmLabel: "Abmelden", danger: true },
        );
        if (!ok) return;
        setBusy(true);
        const result = await runAction(logout);
        if (!result.ok) {
            // Ohne Server bliebe das Login-Cookie gültig – beim nächsten Online-Gehen wäre man wieder angemeldet
            setBusy(false);
            toast({ message: "Abmelden geht nur mit Internetverbindung.", variant: "error" });
            return;
        }
        await signedOut();
    };

    const signOutOthers = async () => {
        if (
            !(await confirm({
                title: "Auf allen anderen Geräten abmelden?",
                message: "Dort muss man sich dann neu anmelden. API-Tokens (z. B. für Home Assistant) bleiben gültig – die löschst du bei Bedarf unten einzeln.",
                confirmLabel: "Abmelden",
            }))
        )
            return;
        const result = await runAction(logoutEverywhere);
        toast(result.ok ? { message: "Alle anderen Geräte wurden abgemeldet.", variant: "success" } : { message: result.error, variant: "error" });
    };

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 pt-2">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-10 h-10 text-primary" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-2xl font-black truncate">{user.name}</h2>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-2 mt-1">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        {user.email}
                    </p>
                </div>
            </div>

            <Section title="Konto" icon={<User className="w-3.5 h-3.5" />}>
                <NameForm user={user} />
            </Section>

            <Section title="Sicherheit" icon={<Shield className="w-3.5 h-3.5" />}>
                <Row icon={<MonitorSmartphone className="w-4 h-4" />} title="Andere Geräte abmelden">
                    <button type="button" onClick={signOutOthers} className="text-xs font-bold text-primary hover:underline shrink-0">
                        Abmelden
                    </button>
                </Row>
            </Section>

            <Section title="Erscheinungsbild" icon={theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}>
                <div className="py-3 px-4 bg-accent/20 border-2 border-border/50 rounded-xl">
                    <Toggle
                        checked={theme === "dark"}
                        onChange={(checked) => setTheme(checked ? "dark" : "light")}
                        label="Dunkler Modus"
                        icon={theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    />
                </div>
            </Section>

            <ReminderSection />

            <ApiSection />

            <Section title="Abmelden" icon={<LogOut className="w-3.5 h-3.5" />} variant="danger">
                <Button variant="danger" onClick={signOut} disabled={busy} className="w-full py-4 text-sm font-black uppercase tracking-widest">
                    {busy ? <Spinner /> : <LogOut className="w-4 h-4" />}
                    Abmelden
                </Button>
            </Section>

            <p className="text-center text-[10px] font-mono text-muted-foreground">
                My Home {APP_VERSION && `v${APP_VERSION}`}
                {lastSyncedAt && ` · zuletzt synchronisiert ${formatDateTime(lastSyncedAt)}`}
            </p>
        </div>
    );
}
