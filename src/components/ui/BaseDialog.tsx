"use client";

/* ============================================================================
   BASE DIALOG
   ============================================================================
   Wiederverwendbarer Dialog mit mobil optimiertem Verhalten.

   - Mobil: Bottom-Sheet, das von unten einfährt und über der Tastatur bleibt
   - Desktop: zentriert mit Blur-Hintergrund
   - Barrierearm: role="dialog", Fokus wandert in den Dialog (auf ein Element mit
     autoFocus/data-autofocus, sonst auf den Dialog selbst – so springt mobil nicht
     ungefragt die Tastatur auf) und zurück, Tab bleibt im Dialog, ESC schließt
     nur den obersten Dialog, Hintergrund scrollt nicht mit
   - Rendert per Portal in <body> (keine z-index-/overflow-Probleme)
============================================================================ */

import { AnimatePresence, motion, useIsPresent } from "framer-motion";
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

/**
 * Bildschirmtastatur (iOS/Android): wie weit das Sheet nach oben muss und wie viel
 * Platz darüber bleibt – sonst rutschen Kopfzeile und Schließen-Knopf aus dem Bild.
 */
function useKeyboard(active: boolean) {
    const [kb, setKb] = useState({ offset: 0, available: 0 });
    useEffect(() => {
        const vv = window.visualViewport;
        if (!active || !vv) return;
        const update = () => {
            const diff = window.innerHeight - vv.height - vv.offsetTop;
            setKb(diff > 100 ? { offset: diff, available: vv.height } : { offset: 0, available: 0 });
        };
        vv.addEventListener("resize", update);
        vv.addEventListener("scroll", update);
        return () => {
            vv.removeEventListener("resize", update);
            vv.removeEventListener("scroll", update);
            setKb({ offset: 0, available: 0 });
        };
    }, [active]);
    return kb;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const noopSubscribe = () => () => {};

/** Während der Schließ-Animation fängt der Dialog keine Taps mehr ab. */
function DialogLayer({ children, zIndex }: { children: ReactNode; zIndex: number }) {
    const isPresent = useIsPresent();
    return (
        <div className="fixed inset-0 flex items-center justify-center sm:p-4" style={{ zIndex, pointerEvents: isPresent ? undefined : "none" }}>
            {children}
        </div>
    );
}

// Stapel offener Dialoge: ESC und Fokus gehören immer dem obersten.
const openStack: string[] = [];
// Die letzten beiden fokussierten Elemente: Setzt ein Dialog per autoFocus den Fokus
// schon beim Rendern (vor unserem Effect), ist das vorletzte der Auslöser, zu dem der
// Fokus beim Schließen zurückkehren soll.
let lastFocused: Element | null = null;
let focusedBefore: Element | null = null;
if (typeof document !== "undefined") {
    document.addEventListener(
        "focusin",
        (e) => {
            if (e.target === lastFocused) return;
            focusedBefore = lastFocused;
            lastFocused = e.target as Element;
        },
        true,
    );
}

// Scroll-Sperre nur beim ersten öffnenden / letzten schließenden Dialog anfassen –
// sonst stellt ein gleichzeitig geschlossener Dialog evtl. "hidden" wieder her.
let savedOverflow = "";

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
    const keyboard = useKeyboard(isOpen && isMobile);
    const panelRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;
        openStack.push(id);
        if (openStack.length === 1) {
            savedOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        }
        const active = document.activeElement;
        const previouslyFocused = (panelRef.current && active && panelRef.current.contains(active) ? focusedBefore : active) as HTMLElement | null;

        // Fokus in den Dialog (Elemente mit autoFocus fokussiert React schon selbst)
        const focusTimer = setTimeout(() => {
            const panel = panelRef.current;
            if (!panel || panel.contains(document.activeElement)) return;
            (panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel).focus({ preventScroll: true });
        }, 50);

        const onKey = (e: KeyboardEvent) => {
            if (openStack[openStack.length - 1] !== id) return;
            if (e.key === "Escape") {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            const panel = panelRef.current;
            if (e.key !== "Tab" || !panel) return;
            // Fokusfalle: Tab wandert nicht in die Seite hinter dem Dialog
            const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
            const active = document.activeElement;
            if (!items.length) {
                e.preventDefault();
                panel.focus();
            } else if (!panel.contains(active)) {
                e.preventDefault();
                items[0].focus();
            } else if (e.shiftKey && (active === items[0] || active === panel)) {
                e.preventDefault();
                items[items.length - 1].focus();
            } else if (!e.shiftKey && active === items[items.length - 1]) {
                e.preventDefault();
                items[0].focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => {
            clearTimeout(focusTimer);
            window.removeEventListener("keydown", onKey);
            const idx = openStack.lastIndexOf(id);
            if (idx >= 0) openStack.splice(idx, 1);
            if (openStack.length === 0) document.body.style.overflow = savedOverflow;
            previouslyFocused?.focus?.({ preventScroll: true });
        };
    }, [isOpen, id]);

    if (!isClient) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <DialogLayer key="dialog" zIndex={zIndex}>
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
                                ? { y: -keyboard.offset, transition: { type: "spring", damping: 28, stiffness: 260 } }
                                : { opacity: 1, scale: 1, y: 0 }
                        }
                        style={keyboard.offset ? { maxHeight: keyboard.available - 12, paddingBottom: 0 } : undefined}
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
                                            type="button"
                                            data-dialog-close
                                            onClick={onClose}
                                            className="p-3 -m-1 hover:bg-accent rounded-full transition-colors"
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
                </DialogLayer>
            )}
        </AnimatePresence>,
        document.body,
    );
}
