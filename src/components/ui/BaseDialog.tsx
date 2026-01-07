"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
    showCloseButton?: boolean;
    footer?: React.ReactNode;
}

export function BaseDialog({
    isOpen,
    onClose,
    title,
    children,
    className,
    showCloseButton = true,
    footer,
}: BaseDialogProps) {
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        const handleVisualViewportChange = () => {
            if (window.visualViewport) {
                const heightDiff = window.innerHeight - window.visualViewport.height;
                // Only consider it a keyboard if the height difference is significant
                setKeyboardHeight(heightDiff > 100 ? heightDiff : 0);
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", handleVisualViewportChange);
            window.visualViewport.addEventListener("scroll", handleVisualViewportChange);
        }

        return () => {
            window.removeEventListener("resize", checkMobile);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener("resize", handleVisualViewportChange);
                window.visualViewport.removeEventListener("scroll", handleVisualViewportChange);
            }
        };
    }, []);

    // Close on ESC
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
                            "sm:max-w-lg sm:rounded-2xl sm:border",
                            "max-sm:rounded-t-3xl max-sm:border-t max-sm:max-h-[85vh]",
                            className
                        )}
                    >
                        {/* Mobile Handle */}
                        <div className="sm:hidden flex justify-center p-2">
                            <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
                        </div>

                        {(title || showCloseButton) && (
                            <div className="flex justify-between items-center p-4 border-b border-border">
                                {title && <h2 className="text-xl font-black tracking-tight">{title}</h2>}
                                {showCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-accent rounded-full transition-colors ml-auto"
                                        aria-label="Schließen"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
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
