"use client";

import { motion } from "framer-motion";
import { ChevronDown, Moon, Sun, User } from "lucide-react";
import { ReactNode } from "react";

interface DashboardHeaderProps {
    selectedHouseholdName: string;
    isHouseholdMenuOpen: boolean;
    setIsHouseholdMenuOpen: (open: boolean) => void;
    theme: "light" | "dark";
    onToggleTheme: () => void;
    userName?: string;
    onOpenProfile: () => void;
    children?: ReactNode; // For the HouseholdMenu dropdown
}

export function DashboardHeader({
    selectedHouseholdName,
    isHouseholdMenuOpen,
    setIsHouseholdMenuOpen,
    theme,
    onToggleTheme,
    userName,
    onOpenProfile,
    children,
}: DashboardHeaderProps) {
    return (
        <header className="fixed bg-background top-0 left-0 right-0 z-50 flex justify-between items-center px-4 py-2 border-b border-border">
            <div className="relative">
                <button
                    onClick={() => setIsHouseholdMenuOpen(!isHouseholdMenuOpen)}
                    className="group flex items-center gap-2 text-2xl font-black tracking-tighter hover:text-muted-foreground transition-colors"
                >
                    {selectedHouseholdName}
                    <motion.div
                        animate={{ rotate: isHouseholdMenuOpen ? 180 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        <ChevronDown className="w-5 h-5 opacity-50" />
                    </motion.div>
                </button>

                {children}
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={onToggleTheme}
                    className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    title={theme === "light" ? "Dunkelmodus aktivieren" : "Hellmodus aktivieren"}
                >
                    {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
            </div>
        </header>
    );
}
