"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, ListTodo, StickyNote, Gauge, User } from "lucide-react";

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
    const tabs = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "lists", label: "Listen", icon: ListTodo },
        { id: "notes", label: "Notizen", icon: StickyNote },
        { id: "meters", label: "Zähler", icon: Gauge },
        { id: "profile", label: "Profil", icon: User },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-background via-background to-transparent md:max-w-md md:mx-auto">
            <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl flex items-center justify-between p-2 shadow-2xl shadow-foreground/5">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 min-w-16 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-primary/10 rounded-xl"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <Icon className={`w-5 h-5 mb-1 ${isActive ? "scale-110" : "scale-100"} transition-transform`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
