/* ============================================================================
   BASE DIALOG COMPONENT
   ============================================================================

   Wiederverwendbarer Dialog/Modal mit Mobile-optimiertem Verhalten.

   Features:
   - Mobile: Slide-up von unten mit Native-App-Feel
   - Desktop: Fade-in in der Mitte mit Blur-Backdrop
   - Keyboard-Unterstützung (ESC zum Schließen)
   - Auto-Anpassung an Mobile-Keyboard (iOS/Android)
   - Optionaler Header, Footer und Close-Button
   - Framer Motion Animationen für smooth UX

   Props:
   - isOpen: boolean - Steuert Sichtbarkeit des Dialogs
   - onClose: () => void - Callback beim Schließen
   - title: string - Optionaler Dialog-Titel
   - children: ReactNode - Dialog-Inhalt
   - className: string - Zusätzliche CSS-Klassen
   - showCloseButton: boolean - Zeigt X-Button (default: true)
   - footer: ReactNode - Optionaler Footer-Bereich (z.B. Action-Buttons)
   - headerAction: ReactNode - Custom Actions im Header (z.B. Delete-Button)

   Verwendung:
   ```tsx
   <BaseDialog
     isOpen={isOpen}
     onClose={() => setIsOpen(false)}
     title="Notiz bearbeiten"
     footer={
       <Button onClick={handleSave}>Speichern</Button>
     }
   >
     <textarea value={note} onChange={...} />
   </BaseDialog>
   ```

   Responsive Behavior:
   - Mobile (<640px): Full-width, slides from bottom, rounded top corners
   - Desktop (≥640px): Centered, max-width, rounded all corners
============================================================================ */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

interface BaseDialogProps {
    /** Kontrolliert Sichtbarkeit des Dialogs */
    isOpen: boolean;

    /** Callback beim Schließen (ESC, Backdrop-Click, Close-Button) */
    onClose: () => void;

    /** Optionaler Titel im Dialog-Header */
    title?: string;

    /** Dialog-Inhalt */
    children: React.ReactNode;

    /** Zusätzliche CSS-Klassen für den Dialog-Container */
    className?: string;

    /** Zeigt X-Button zum Schließen (default: true) */
    showCloseButton?: boolean;

    /** Optionaler Footer-Bereich (z.B. Action-Buttons) */
    footer?: React.ReactNode;

    /** Custom Actions im Header (z.B. Delete-Button neben Close) */
    headerAction?: React.ReactNode;
}

/* ============================================================================
   COMPONENT
============================================================================ */

export function BaseDialog({
    isOpen,
    onClose,
    title,
    children,
    className,
    showCloseButton = true,
    footer,
    headerAction,
}: BaseDialogProps) {
    /* ========================================================================
       STATE MANAGEMENT
       ========================================================================
       - keyboardHeight: Höhe des mobilen Keyboards (iOS/Android)
       - isMobile: Ist Device mobile? (< 640px)
       - isMounted: Verhindert SSR-Probleme mit window-API */
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    /* ========================================================================
       MOBILE & KEYBOARD DETECTION
       ========================================================================
       Erkennt Device-Größe und Mobile-Keyboard für optimale Darstellung */
    useEffect(() => {
        setIsMounted(true);

        // Check ob Mobile basierend auf Screen-Width
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        // Keyboard-Height Detection für iOS/Android
        // Wichtig: Dialog muss sich nach oben schieben wenn Keyboard öffnet
        const handleVisualViewportChange = () => {
            if (window.visualViewport) {
                const heightDiff = window.innerHeight - window.visualViewport.height;
                // Nur als Keyboard betrachten wenn Unterschied > 100px
                // (kleine Viewport-Changes ignorieren)
                setKeyboardHeight(heightDiff > 100 ? heightDiff : 0);
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", handleVisualViewportChange);
            window.visualViewport.addEventListener("scroll", handleVisualViewportChange);
        }

        // Cleanup
        return () => {
            window.removeEventListener("resize", checkMobile);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener("resize", handleVisualViewportChange);
                window.visualViewport.removeEventListener("scroll", handleVisualViewportChange);
            }
        };
    }, []);

    /* ========================================================================
       KEYBOARD NAVIGATION
       ========================================================================
       ESC-Taste schließt Dialog (Standard UX Pattern) */
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    return (
        <AnimatePresence>
            {(isMounted && isOpen) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Dialog Content */}
                    <motion.div
                        ref={dialogRef}
                        initial={isMobile ? { y: "100%", opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95, y: 20 }}
                        animate={isMobile
                            ? { y: -keyboardHeight, opacity: 1, scale: 1, transition: { type: "spring", damping: 25, stiffness: 200 } }
                            : { opacity: 1, scale: 1, y: 0 }
                        }
                        exit={isMobile ? { y: "100%", opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95, y: 20 }}
                        style={{
                            // Ensure the dialog stays at the bottom on mobile
                            bottom: isMobile ? 0 : "auto",
                            position: isMobile ? "fixed" : "relative"
                        }}
                        className={cn(
                            "w-full bg-card border-border shadow-2xl flex flex-col overflow-hidden",
                            "sm:max-w-lg sm:rounded-2xl sm:border sm:max-h-[85vh]",
                            "max-sm:rounded-t-3xl max-sm:border-t max-sm:max-h-[85vh]",
                            className
                        )}
                    >
                        {/* Mobile Handle */}
                        <div className="sm:hidden flex justify-center p-2">
                            <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
                        </div>

                        {(title || showCloseButton || headerAction) && (
                            <div className="flex justify-between items-center p-4 border-b border-border">
                                {title && <h2 className="text-xl font-black tracking-tight">{title}</h2>}
                                <div className="flex items-center gap-2 ml-auto">
                                    {headerAction}
                                    {showCloseButton && (
                                        <button
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

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {children}
                        </div>

                        {footer && (
                            <div className="p-4 border-t border-border bg-accent/5 mt-auto">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
