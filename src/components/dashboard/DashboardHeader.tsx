"use client";

import { motion } from "framer-motion";
import { ChevronDown, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { SyncIndicator } from "./SyncIndicator";

interface DashboardHeaderProps {
    title: string;
    menuOpen: boolean;
    onToggleMenu: () => void;
    /** Haushaltsmenü (Dropdown) */
    children?: ReactNode;
}

export function DashboardHeader({ title, menuOpen, onToggleMenu, children }: DashboardHeaderProps) {
    const { theme, toggle } = useTheme();
    return (
        <header className="fixed bg-background/95 backdrop-blur top-0 inset-x-0 z-50 border-b border-border pt-[env(safe-area-inset-top)]">
            <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-2 md:px-8">
                <div className="relative min-w-0">
                    <button
                        type="button"
                        data-household-toggle
                        onClick={onToggleMenu}
                        aria-expanded={menuOpen}
                        aria-haspopup="listbox"
                        className="group text-left min-w-0 block"
                    >
                        <span className="flex items-center gap-2 text-2xl font-black tracking-tighter hover:text-muted-foreground transition-colors">
                            <span className="truncate">{title}</span>
                            <motion.span animate={{ rotate: menuOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="shrink-0">
                                <ChevronDown className="w-5 h-5 opacity-50" />
                            </motion.span>
                        </span>
                    </button>
                    <SyncIndicator />
                    {children}
                </div>
                <button
                    type="button"
                    onClick={toggle}
                    className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    aria-label={theme === "light" ? "Dunkelmodus aktivieren" : "Hellmodus aktivieren"}
                >
                    {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
            </div>
        </header>
    );
}
