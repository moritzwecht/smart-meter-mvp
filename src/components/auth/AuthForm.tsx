"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, RotateCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { requestLoginCode, verifyLoginCode } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { runAction } from "@/lib/client-actions";
import { signedIn } from "@/lib/offline/session";
import type { SessionUser } from "@/lib/sync/types";

interface AuthFormProps {
    initialEmail?: string;
    /** Bei Anmeldung über eine Einladung: wird mitgeschickt, damit man direkt beitritt. */
    inviteToken?: string;
    /** Zusätzlich nach erfolgreicher Anmeldung (die Session wird immer gesetzt). */
    onSuccess?: (user: SessionUser) => void;
}

const RESEND_SECONDS = 30;

/**
 * Anmeldung ohne Passwort: E-Mail-Adresse → 6-stelliger Code per Mail.
 * Neue Konten entstehen dabei automatisch – es gibt kein getrenntes "Registrieren".
 */
export function AuthForm({ initialEmail = "", inviteToken, onSuccess }: AuthFormProps) {
    const [step, setStep] = useState<"email" | "code">("email");
    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const sendCode = async () => {
        setError("");
        setLoading(true);
        const result = await runAction(() => requestLoginCode({ email }));
        setLoading(false);
        if (!result.ok) return setError(result.error);
        setCode("");
        setStep("code");
        setCooldown(RESEND_SECONDS);
    };

    const verify = async (value: string) => {
        setError("");
        setLoading(true);
        const result = await runAction(() => verifyLoginCode({ email, code: value, inviteToken }));
        if (!result.ok) {
            setLoading(false);
            setError(result.error);
            setCode("");
            return;
        }
        await signedIn(result.data);
        onSuccess?.(result.data);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (loading) return;
        if (step === "email") void sendCode();
        else void verify(code);
    };

    return (
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="space-y-4 p-1" noValidate>
            {step === "email" ? (
                <>
                    <Input
                        label="E-Mail-Adresse"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        required
                        autoFocus={!initialEmail}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@beispiel.de"
                    />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Du bekommst einen 6-stelligen Code per E-Mail – ein Passwort brauchst du nicht. Neu hier? Dann wird dein Konto dabei automatisch angelegt.
                    </p>
                </>
            ) : (
                <>
                    <p className="text-sm leading-relaxed">
                        Wir haben dir einen Code an <strong className="break-all">{email}</strong> geschickt. Schau auch im Spam-Ordner nach.
                    </p>
                    <Input
                        label="6-stelliger Code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9 ]*"
                        maxLength={7}
                        autoFocus
                        required
                        value={code}
                        onChange={(e) => {
                            const next = e.target.value.replace(/[^\d ]/g, "");
                            setCode(next);
                            // Vollständig (auch per Autofill aus der Mail) → direkt anmelden
                            const digits = next.replace(/\D/g, "");
                            if (digits.length === 6 && !loading) void verify(digits);
                        }}
                        placeholder="123 456"
                        className="text-2xl font-black tracking-[0.3em] tabular-nums"
                    />
                </>
            )}

            {error && <Alert variant="error">{error}</Alert>}

            <div className="space-y-2 pt-2">
                <button type="submit" disabled={loading || (step === "email" ? !email.trim() : code.replace(/\D/g, "").length !== 6)} className="w-full btn btn-primary py-3.5 group">
                    {loading ? (
                        <Spinner className="text-primary-foreground" />
                    ) : (
                        <>
                            <span>{step === "email" ? "Code senden" : "Anmelden"}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                {step === "code" && (
                    <div className="flex flex-col sm:flex-row gap-1">
                        <button
                            type="button"
                            onClick={() => void sendCode()}
                            disabled={loading || cooldown > 0}
                            className="flex-1 min-h-11 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-primary disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                            {cooldown > 0 ? `Neuer Code in ${cooldown} s` : "Neuen Code senden"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStep("email");
                                setError("");
                            }}
                            className="flex-1 min-h-11 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Andere E-Mail-Adresse
                        </button>
                    </div>
                )}
            </div>
        </motion.form>
    );
}
