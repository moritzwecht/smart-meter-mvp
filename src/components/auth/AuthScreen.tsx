"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { usePendingCount } from "@/lib/offline/hooks";
import type { SessionUser } from "@/lib/sync/types";
import { AuthForm } from "./AuthForm";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

export function AuthShell({ children }: { children: ReactNode }) {
    return (
        <main className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background pt-[env(safe-area-inset-top)]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black tracking-tighter text-foreground">My Home</h1>
                    {APP_VERSION && <p className="text-sm text-muted-foreground font-mono">v{APP_VERSION}</p>}
                </div>
                <div className="bg-card text-card-foreground rounded-2xl border border-border p-4 shadow-xl shadow-foreground/5">
                    {children}
                </div>
            </motion.div>
        </main>
    );
}

export function AuthScreen({ expired }: { expired?: boolean }) {
    const pending = usePendingCount();
    // Bei abgelaufener Sitzung: E-Mail des bisherigen Kontos vorausfüllen
    const cached = useLiveQuery(async () => (expired ? (((await db.meta.get("user"))?.value as SessionUser | undefined) ?? null) : null), [expired]);
    if (cached === undefined) return <AuthShell>{null}</AuthShell>;
    return (
        <AuthShell>
            {expired && (
                <Alert variant="info" className="mb-4">
                    Deine Sitzung ist abgelaufen. Bitte melde dich erneut an
                    {pending > 0
                        ? ` – ${pending} noch nicht synchronisierte Änderung${pending === 1 ? " wird" : "en werden"} übertragen, sobald du wieder mit diesem Konto angemeldet bist.`
                        : "."}
                </Alert>
            )}
            <AuthForm initialEmail={cached?.email ?? ""} />
        </AuthShell>
    );
}
