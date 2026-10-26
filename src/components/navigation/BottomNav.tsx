"use client";

import { motion } from "framer-motion";
import { Gauge, LayoutDashboard, ListTodo, StickyNote, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "dashboard" | "lists" | "notes" | "meters" | "profile";

export const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "lists", label: "Listen", icon: ListTodo },
    { id: "notes", label: "Notizen", icon: StickyNote },
    { id: "meters", label: "Zähler", icon: Gauge },
    { id: "profile", label: "Profil", icon: User },
];

export function BottomNav({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
    return (
        <nav
            aria-label="Hauptnavigation"
            className="fixed bottom-0 inset-x-0 z-50 px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-transparent md:max-w-md md:mx-auto"
        >
            <div className="bg-foreground text-background border border-foreground/10 rounded-full flex items-center justify-between p-2 shadow-2xl shadow-foreground/20">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            aria-label={tab.label}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                                "relative flex items-center justify-center p-2 rounded-full transition-colors duration-300 min-w-13 aspect-square",
                                isActive ? "text-background" : "text-background/60 hover:text-background",
                            )}
                        >
                            {isActive && (
                                <motion.div layoutId="activeTab" className="absolute inset-0 bg-background/10 rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                            )}
                            <Icon className={cn("w-5 h-5 transition-transform", isActive && "scale-120")} />
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
