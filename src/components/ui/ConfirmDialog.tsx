"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { BaseDialog } from "./BaseDialog";
import { Button } from "./Button";

/*
 * Bestätigungsdialog im App-Design statt `window.confirm()`.
 * Verwendung: `if (await confirm({ title: "Löschen?", danger: true })) …`
 */

interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error("useConfirm muss innerhalb von <ConfirmProvider> verwendet werden");
    return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolver = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions) => {
        resolver.current?.(false);
        setOptions(opts);
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    const close = useCallback((value: boolean) => {
        resolver.current?.(value);
        resolver.current = null;
        setOptions(null);
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <BaseDialog
                isOpen={!!options}
                onClose={() => close(false)}
                title={options?.title}
                className="sm:max-w-sm"
                zIndex={150}
                footer={
                    <div className="flex gap-2">
                        {/* Bei gefährlichen Aktionen liegt der Fokus auf "Abbrechen" (Enter löscht nicht versehentlich) */}
                        <Button variant="ghost" className="flex-1 py-3" onClick={() => close(false)} autoFocus={!!options?.danger}>
                            {options?.cancelLabel ?? "Abbrechen"}
                        </Button>
                        <Button
                            variant={options?.danger ? "danger" : "primary"}
                            className="flex-1 py-3"
                            onClick={() => close(true)}
                            autoFocus={!options?.danger}
                        >
                            {options?.confirmLabel ?? "OK"}
                        </Button>
                    </div>
                }
            >
                {options?.message && <p className="text-sm text-muted-foreground leading-relaxed">{options.message}</p>}
            </BaseDialog>
        </ConfirmContext.Provider>
    );
}
