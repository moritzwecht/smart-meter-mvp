"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptInvite, logout } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { runAction } from "@/lib/client-actions";
import { signedOut } from "@/lib/offline/session";
import type { SessionUser } from "@/lib/sync/types";
import { AuthForm } from "./AuthForm";
import { AuthShell } from "./AuthScreen";

interface InviteAcceptProps {
    token: string;
    invite: { email: string; householdName: string; inviterName: string | null; accountExists: boolean } | null;
    user: SessionUser | null;
}

export function InviteAccept({ token, invite, user }: InviteAcceptProps) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

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
                            onClick={async () => {
                                await runAction(logout);
                                await signedOut(); // lokale Daten des bisherigen Kontos verwerfen
                                window.location.reload();
                            }}
                            className="w-full py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                        >
                            Mit anderem Konto anmelden
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            {invite.accountExists ? "Melde dich an, um beizutreten." : "Erstelle ein Konto (oder melde dich an), um beizutreten."}
                        </p>
                        {error && <Alert variant="error">{error}</Alert>}
                        <AuthForm
                            initialMode={invite.accountExists ? "login" : "register"}
                            initialEmail={invite.email}
                            inviteToken={token}
                            // Nach der Registrierung ist man schon Mitglied – acceptInvite bestätigt das nur
                            onSuccess={() => void join()}
                        />
                    </div>
                )}
            </div>
        </AuthShell>
    );
}
