"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Edit2 } from "lucide-react";

interface HouseholdMenuProps {
    isOpen: boolean;
    households: any[];
    selectedHouseholdId: number | null;
    onSelectHousehold: (id: number) => void;
    onEditHousehold: (household: any) => void;
    newHouseholdName: string;
    setNewHouseholdName: (name: string) => void;
    onCreateHousehold: (e: React.FormEvent) => void;
}

export function HouseholdMenu({
    isOpen,
    households,
    selectedHouseholdId,
    onSelectHousehold,
    onEditHousehold,
    newHouseholdName,
    setNewHouseholdName,
    onCreateHousehold,
}: HouseholdMenuProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-4 w-72 bg-card border border-border shadow-2xl rounded-xl z-50 p-2 space-y-2 overflow-hidden"
                >
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-3 py-2 border-b border-border/50">
                        Deine Haushalte
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {households.map((h) => (
                            <div key={h.id} className="flex group px-1">
                                <button
                                    onClick={() => onSelectHousehold(h.id)}
                                    className={`flex-1 text-left px-3 py-2 rounded-lg font-medium text-sm transition-colors ${h.id === selectedHouseholdId
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:bg-accent/50"
                                        }`}
                                >
                                    {h.name}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditHousehold(h);
                                    }}
                                    className={`p-2 hover:text-primary transition-colors ${h.role !== "OWNER" ? "hidden" : ""
                                        }`}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-border mt-2 pt-2 px-2">
                        <form onSubmit={onCreateHousehold} className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="Neuer Haushalt..."
                                value={newHouseholdName}
                                onChange={(e) => setNewHouseholdName(e.target.value)}
                                className="w-full text-sm bg-transparent border-none focus:ring-0 px-2 py-1 outline-none"
                            />
                            <button
                                type="submit"
                                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 pb-2 text-left"
                            >
                                + Haushalt hinzufügen
                            </button>
                        </form>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
