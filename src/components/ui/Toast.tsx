"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Kurze Hinweise statt `alert()`: nicht blockierend, im App-Design und
 * mit optionaler Aktion (z. B. "Link kopieren", "Neu laden").
 */

type ToastVariant = "info" | "success" | "error";

interface ToastOptions {
    message: string;
    variant?: ToastVariant;
    action?: { label: string; onClick: () => void };
    /** ms, 0 = bleibt stehen */
    duration?: number;
}

interface ToastEntry extends ToastOptions {
    id: number;
}

const ToastContext = createContext<((options: ToastOptions | string) => void) | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast muss innerhalb von <ToastProvider> verwendet werden");
    return ctx;
}

const icons = { info: Info, success: CheckCircle2, error: AlertCircle };

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastEntry[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    const show = useCallback(
        (options: ToastOptions | string) => {
            const opts = typeof options === "string" ? { message: options } : options;
            const id = nextId.current++;
            setToasts((t) => [...t.filter((x) => x.message !== opts.message), { ...opts, id }].slice(-3));
            const duration = opts.duration ?? (opts.variant === "error" ? 6000 : 3500);
            if (duration > 0) setTimeout(() => dismiss(id), duration);
        },
        [dismiss],
    );

    const value = useMemo(() => show, [show]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                aria-live="polite"
                className="fixed inset-x-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none bottom-[calc(6.5rem+env(safe-area-inset-bottom))]"
            >
                <AnimatePresence initial={false}>
                    {toasts.map((t) => {
                        const Icon = icons[t.variant ?? "info"];
                        return (
                            <motion.div
                                key={t.id}
                                layout
                                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                                role={t.variant === "error" ? "alert" : "status"}
                                className={cn(
                                    "pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl",
                                    "bg-card text-card-foreground border-border",
                                    t.variant === "error" && "border-red-300 dark:border-red-900/60",
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-4 h-4 shrink-0",
                                        t.variant === "error" ? "text-red-500" : t.variant === "success" ? "text-emerald-500" : "text-muted-foreground",
                                    )}
                                />
                                <span className="flex-1">{t.message}</span>
                                {t.action && (
                                    <button
                                        onClick={() => {
                                            t.action!.onClick();
                                            dismiss(t.id);
                                        }}
                                        className="shrink-0 text-xs font-black uppercase tracking-wider text-primary hover:opacity-80"
                                    >
                                        {t.action.label}
                                    </button>
                                )}
                                <button onClick={() => dismiss(t.id)} aria-label="Hinweis schließen" className="shrink-0 p-1 -m-1 text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
