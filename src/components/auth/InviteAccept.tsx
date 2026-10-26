"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptInvite, logout } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { runAction } from "@/lib/client-actions";
import { usePendingCount } from "@/lib/offline/hooks";
import { signedOut } from "@/lib/offline/session";
import type { SessionUser } from "@/lib/sync/types";
import { AuthForm } from "./AuthForm";
import { AuthShell } from "./AuthScreen";

interface InviteAcceptProps {
    token: string;
    invite: { email: string; householdName: string; inviterName: string | null } | null;
    user: SessionUser | null;
}

export function InviteAccept({ token, invite, user }: InviteAcceptProps) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const pending = usePendingCount();
    const confirm = useConfirm();

    const join = async () => {
        setBusy(true);
        setError("");
        const result = await runAction(() => acceptInvite({ token }));
        if (!result.ok) {
            setBusy(false);
            setError(result.error);
            return;
        }
        router.replace("/");
    };

    /** Abmelden, um die Einladung mit einem anderen Konto anzunehmen – ohne stillen Datenverlust. */
    const switchAccount = async () => {
        if (
            pending > 0 &&
            !(await confirm({
                title: "Trotzdem abmelden?",
                message: `${pending} Änderung${pending === 1 ? " ist" : "en sind"} auf diesem Gerät noch nicht synchronisiert und ${pending === 1 ? "würde" : "würden"} verloren gehen.`,
                confirmLabel: "Abmelden",
                danger: true,
            }))
        )
            return;
        setBusy(true);
        const result = await runAction(logout);
        if (!result.ok) {
            setBusy(false);
            setError("Abmelden geht nur mit Internetverbindung.");
            return;
        }
        await signedOut(); // lokale Daten des bisherigen Kontos verwerfen
        window.location.reload();
    };

    if (!invite) {
        return (
            <AuthShell>
                <div className="space-y-4 text-center">
                    <p className="text-sm">Diese Einladung ist ungültig, abgelaufen oder wurde bereits verwendet.</p>
                    <p className="text-sm text-muted-foreground">Bitte die Person, die dich eingeladen hat, um einen neuen Link.</p>
                    <Link href="/" className="btn btn-primary py-3 w-full">
                        Zur App
                    </Link>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell>
            <div className="space-y-6">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Home className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-sm leading-relaxed">
                        {invite.inviterName ? <strong>{invite.inviterName}</strong> : "Jemand"} hat dich in den Haushalt{" "}
                        <strong>„{invite.householdName}“</strong> eingeladen.
                    </p>
                </div>

                {user ? (
                    <div className="space-y-4">
                        {user.email !== invite.email && (
                            <Alert variant="info">
                                Die Einladung ging an {invite.email}. Du bist als {user.email} angemeldet – beim Beitreten wird dieses Konto hinzugefügt.
                            </Alert>
                        )}
                        {error && <Alert variant="error">{error}</Alert>}
                        <button type="button" onClick={join} disabled={busy} className="w-full btn btn-primary py-3.5">
                            {busy ? <Spinner className="text-primary-foreground" /> : `Als ${user.name} beitreten`}
                        </button>
                        <button
                            type="button"
                            onClick={switchAccount}
                            disabled={busy}
                            className="w-full min-h-11 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                        >
                            Mit anderem Konto anmelden
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {error && <Alert variant="error">{error}</Alert>}
                        <AuthForm
                            initialEmail={invite.email}
                            inviteToken={token}
                            // Mit dem Code ist man schon beigetreten – acceptInvite bestätigt das nur
                            onSuccess={() => void join()}
                        />
                    </div>
                )}
            </div>
        </AuthShell>
    );
}
