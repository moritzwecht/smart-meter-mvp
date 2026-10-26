"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { resetPassword } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { runAction } from "@/lib/client-actions";
import { AuthShell } from "./AuthScreen";

export function ResetPasswordForm({ token }: { token: string }) {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [repeat, setRepeat] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        if (password !== repeat) return setError("Die Passwörter stimmen nicht überein.");
        setBusy(true);
        const result = await runAction(() => resetPassword({ token, password }));
        if (!result.ok) {
            setBusy(false);
            return setError(result.error);
        }
        router.replace("/");
    };

    return (
        <AuthShell>
            <form onSubmit={submit} className="space-y-4 p-1">
                <p className="text-sm text-muted-foreground">Lege ein neues Passwort fest. Danach bist du direkt angemeldet; andere Geräte werden abgemeldet.</p>
                <Input label="Neues Passwort" type="password" showPasswordToggle autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mindestens 8 Zeichen" />
                <Input label="Passwort wiederholen" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                {error && <Alert variant="error">{error}</Alert>}
                <button type="submit" disabled={busy || !password} className="w-full btn btn-primary py-3.5">
                    {busy ? <Spinner className="text-primary-foreground" /> : "Passwort speichern"}
                </button>
                <Link href="/" className="block text-center py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary">
                    Zur Anmeldung
                </Link>
            </form>
        </AuthShell>
    );
}
