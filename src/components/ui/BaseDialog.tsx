"use client";

/* ============================================================================
   BASE DIALOG
   ============================================================================
   Wiederverwendbarer Dialog mit mobil optimiertem Verhalten.

   - Mobil: Bottom-Sheet, das von unten einfährt und über der Tastatur bleibt
   - Desktop: zentriert mit Blur-Hintergrund
   - Barrierearm: role="dialog", Fokus wandert in den Dialog und zurück,
     ESC schließt nur den obersten Dialog, Hintergrund scrollt nicht mit
   - Rendert per Portal in <body> (keine z-index-/overflow-Probleme)
============================================================================ */

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface BaseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    className?: string;
    showCloseButton?: boolean;
    footer?: ReactNode;
    headerAction?: ReactNode;
    /** Für Dialoge über Dialogen (z. B. Bestätigungen) */
    zIndex?: number;
}

const mobileQuery = "(max-width: 639px)";

function subscribeMobile(cb: () => void) {
    const mq = window.matchMedia(mobileQuery);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
}

function useIsMobile() {
    return useSyncExternalStore(
        subscribeMobile,
        () => window.matchMedia(mobileQuery).matches,
        () => false,
    );
}

/** Höhe der Bildschirmtastatur (iOS/Android), damit das Sheet darüber bleibt. */
function useKeyboardHeight(active: boolean) {
    const [height, setHeight] = useState(0);
    useEffect(() => {
        const vv = window.visualViewport;
        if (!active || !vv) return;
        const update = () => {
            const diff = window.innerHeight - vv.height - vv.offsetTop;
            setHeight(diff > 100 ? diff : 0);
        };
        vv.addEventListener("resize", update);
        vv.addEventListener("scroll", update);
        return () => {
            vv.removeEventListener("resize", update);
            vv.removeEventListener("scroll", update);
            setHeight(0);
        };
    }, [active]);
    return height;
}

const noopSubscribe = () => () => {};

// Stapel offener Dialoge: ESC und Fokus gehören immer dem obersten.
const openStack: string[] = [];

export function BaseDialog({
    isOpen,
    onClose,
    title,
    children,
    className,
    showCloseButton = true,
    footer,
    headerAction,
    zIndex = 100,
}: BaseDialogProps) {
    const id = useId();
    const titleId = `${id}-title`;
    const isMobile = useIsMobile();
    // Portal erst nach der Hydration rendern (Server kennt kein document)
    const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const keyboardHeight = useKeyboardHeight(isOpen && isMobile);
    const panelRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;
        openStack.push(id);
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";

        // Fokus in den Dialog (Elemente mit autoFocus haben Vorrang)
        const focusTimer = setTimeout(() => {
            const panel = panelRef.current;
            if (!panel || panel.contains(document.activeElement)) return;
            const target = panel.querySelector<HTMLElement>("[autofocus], input, textarea, select, button:not([data-dialog-close])");
            (target ?? panel).focus({ preventScroll: true });
        }, 50);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && openStack[openStack.length - 1] === id) {
                e.stopPropagation();
                onCloseRef.current();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => {
            clearTimeout(focusTimer);
            window.removeEventListener("keydown", onKey);
            const idx = openStack.lastIndexOf(id);
            if (idx >= 0) openStack.splice(idx, 1);
            if (openStack.length === 0) document.body.style.overflow = overflow;
            previouslyFocused?.focus?.({ preventScroll: true });
        };
    }, [isOpen, id]);

    if (!isClient) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 flex items-center justify-center sm:p-4" style={{ zIndex }}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                        aria-hidden
                    />
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? titleId : undefined}
                        tabIndex={-1}
                        initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 16 }}
                        animate={
                            isMobile
                                ? { y: -keyboardHeight, transition: { type: "spring", damping: 28, stiffness: 260 } }
                                : { opacity: 1, scale: 1, y: 0 }
                        }
                        exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 16 }}
                        className={cn(
                            "w-full bg-card text-card-foreground border-border shadow-2xl flex flex-col overflow-hidden outline-none",
                            "max-sm:fixed max-sm:bottom-0 max-sm:rounded-t-3xl max-sm:border-t max-sm:max-h-[90dvh] max-sm:pb-[env(safe-area-inset-bottom)]",
                            "sm:relative sm:max-w-lg sm:rounded-2xl sm:border sm:max-h-[85vh]",
                            className,
                        )}
                    >
                        <div className="sm:hidden flex justify-center pt-2" aria-hidden>
                            <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
                        </div>

                        {(title || showCloseButton || headerAction) && (
                            <div className="flex justify-between items-center gap-2 px-4 py-3 border-b border-border">
                                {title && (
                                    <h2 id={titleId} className="text-xl font-black tracking-tight truncate">
                                        {title}
                                    </h2>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                    {headerAction}
                                    {showCloseButton && (
                                        <button
                                            data-dialog-close
                                            onClick={onClose}
                                            className="p-2 hover:bg-accent rounded-full transition-colors"
                                            aria-label="Schließen"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-4">{children}</div>

                        {footer && <div className="p-4 border-t border-border bg-accent/5">{footer}</div>}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
