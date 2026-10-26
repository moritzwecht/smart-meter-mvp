"use client";

import { useEffect, type ReactNode } from "react";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";

/**
 * Registriert den Service Worker (nur im Produktions-Build) und meldet,
 * wenn nach einem Deployment eine neue Version aktiv geworden ist.
 */
function ServiceWorker() {
    const toast = useToast();
    useEffect(() => {
        if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
        const hadController = !!navigator.serviceWorker.controller;
        const onChange = () => {
            if (!hadController) return; // Erstinstallation, keine neue Version
            toast({
                message: "Eine neue Version ist verfügbar.",
                action: { label: "Neu laden", onClick: () => window.location.reload() },
                duration: 0,
            });
        };
        navigator.serviceWorker.addEventListener("controllerchange", onChange);
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
            console.warn("[sw] Registrierung fehlgeschlagen", error);
        });
        return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    }, [toast]);
    return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <ConfirmProvider>
                <ServiceWorker />
                {children}
            </ConfirmProvider>
        </ToastProvider>
    );
}
