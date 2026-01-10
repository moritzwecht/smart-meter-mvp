import { motion } from "framer-motion";
import { ChevronDown, Moon, Sun, User, CloudOff, CloudSync } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";

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
    const [isOnline, setIsOnline] = useState(true);
    const pendingCount = useLiveQuery(() => db.syncQueue.count()) || 0;

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return (
        <header className="fixed bg-background top-0 left-0 right-0 z-50 flex justify-between items-center px-4 py-2 border-b border-border">
            <div className="relative">
                <button
                    onClick={() => setIsHouseholdMenuOpen(!isHouseholdMenuOpen)}
                    className="group text-left"
                >
                    <div className="flex items-center gap-2 text-2xl font-black tracking-tighter hover:text-muted-foreground transition-colors">
                        {selectedHouseholdName}
                        <motion.div
                            animate={{ rotate: isHouseholdMenuOpen ? 180 : 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                            <ChevronDown className="w-5 h-5 opacity-50" />
                        </motion.div>
                    </div>

                    {!isOnline && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500 animate-pulse">
                            <CloudOff className="w-3 h-3" />
                            <span>Offline</span>
                        </div>
                    )}

                    {isOnline && pendingCount > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                            <CloudSync className="w-3 h-3 animate-spin" />
                            <span>Synchronisiere... ({pendingCount})</span>
                        </div>
                    )}
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
