"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, KeyRound, LogIn, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { login, register, requestPasswordReset } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { runAction } from "@/lib/client-actions";
import { signedIn } from "@/lib/offline/session";
import type { SessionUser } from "@/lib/sync/types";

type Mode = "login" | "register" | "forgot";

interface AuthFormProps {
    initialMode?: Mode;
    initialEmail?: string;
    /** Bei Registrierung über eine Einladung: wird mitgeschickt, damit man direkt beitritt. */
    inviteToken?: string;
    /** Zusätzlich nach erfolgreicher Anmeldung (die Session wird immer gesetzt). */
    onSuccess?: (user: SessionUser) => void;
}

export function AuthForm({ initialMode = "login", initialEmail = "", inviteToken, onSuccess }: AuthFormProps) {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");

    const switchMode = (next: Mode) => {
        setMode(next);
        setError("");
        setInfo("");
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setInfo("");
        if (mode === "register" && password !== confirmPassword) {
            setError("Die Passwörter stimmen nicht überein.");
            return;
        }
        setLoading(true);
        try {
            if (mode === "forgot") {
                const result = await runAction(() => requestPasswordReset({ email }));
                if (!result.ok) setError(result.error);
                else setInfo("Falls es ein Konto mit dieser Adresse gibt, haben wir dir einen Link geschickt. Schau in dein Postfach.");
                return;
            }
            const result = await runAction(() =>
                mode === "login" ? login({ email, password }) : register({ email, password, inviteToken }),
            );
            if (!result.ok) {
                setError(result.error);
                return;
            }
            await signedIn(result.data);
            onSuccess?.(result.data);
        } finally {
            setLoading(false);
        }
    };

    const submitLabel = mode === "login" ? "Anmelden" : mode === "register" ? "Konto erstellen" : "Link anfordern";

    return (
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="space-y-4 p-1" noValidate>
            {mode === "forgot" && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Gib deine E-Mail-Adresse ein. Du bekommst einen Link, mit dem du ein (neues) Passwort festlegen kannst.
                </p>
            )}

            <Input
                label="E-Mail-Adresse"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@beispiel.de"
            />

            {mode !== "forgot" && (
                <Input
                    label="Passwort"
                    type="password"
                    showPasswordToggle
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={mode === "register" ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Mindestens 8 Zeichen" : "••••••••"}
                />
            )}

            <AnimatePresence initial={false}>
                {mode === "register" && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <Input
                            label="Passwort bestätigen"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {error && <Alert variant="error">{error}</Alert>}
            {info && <Alert variant="success">{info}</Alert>}

            <div className="space-y-2 pt-2">
                <button type="submit" disabled={loading} className="w-full btn btn-primary py-3.5 group">
                    {loading ? (
                        <Spinner className="text-primary-foreground" />
                    ) : (
                        <>
                            <span>{submitLabel}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                {mode === "login" && (
                    <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="w-full py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                        <KeyRound className="w-3.5 h-3.5" />
                        Passwort vergessen?
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => switchMode(mode === "login" ? "register" : "login")}
                    className="w-full py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                    {mode === "login" ? (
                        <>
                            <UserPlus className="w-3.5 h-3.5" />
                            Neu hier? Registrieren
                        </>
                    ) : (
                        <>
                            <LogIn className="w-3.5 h-3.5" />
                            Zurück zur Anmeldung
                        </>
                    )}
                </button>
            </div>
        </motion.form>
    );
}
