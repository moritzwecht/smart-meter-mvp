"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Settings2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createHousehold } from "@/app/actions/households";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { runAction } from "@/lib/client-actions";
import { requestSync } from "@/lib/offline/sync-engine";
import { db } from "@/lib/offline/db";
import type { Household } from "@/lib/sync/types";
import { cn } from "@/lib/utils";

interface HouseholdMenuProps {
    isOpen: boolean;
    onClose: () => void;
    households: Household[];
    selectedHouseholdId: number | null;
    onSelect: (id: number) => void;
    onOpenSettings: (id: number) => void;
}

export function HouseholdMenu({ isOpen, onClose, households, selectedHouseholdId, onSelect, onOpenSettings }: HouseholdMenuProps) {
    const toast = useToast();
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Klick außerhalb / ESC schließt das Menü
    useEffect(() => {
        if (!isOpen) return;
        const onPointer = (e: PointerEvent) => {
            const target = e.target as Node;
            if (ref.current && !ref.current.contains(target) && !(target as Element).closest?.("[data-household-toggle]")) onClose();
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [isOpen, onClose]);

    const create = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setCreating(true);
        const result = await runAction(() => createHousehold({ name }));
        setCreating(false);
        if (!result.ok) {
            toast({ message: result.error, variant: "error" });
            return;
        }
        await db.households.put(result.data);
        setName("");
        onSelect(result.data.id);
        requestSync({ immediate: true });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={ref}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.97 }}
                    className="absolute top-full left-0 mt-3 w-72 bg-card border border-border shadow-2xl rounded-xl z-50 p-2 space-y-2"
                >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2 border-b border-border/50">Deine Haushalte</div>
                    <ul className="max-h-[300px] overflow-y-auto custom-scrollbar" aria-label="Haushalt wählen">
                        {households.map((h) => (
                            <li key={h.id} className="flex items-center px-1">
                                <button
                                    type="button"
                                    onClick={() => onSelect(h.id)}
                                    aria-current={h.id === selectedHouseholdId ? "true" : undefined}
                                    className={cn(
                                        "flex-1 flex items-center gap-2 text-left px-3 min-h-11 rounded-lg font-medium text-sm transition-colors min-w-0",
                                        h.id === selectedHouseholdId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                                    )}
                                >
                                    <span className="truncate flex-1">{h.name}</span>
                                    {h.id === selectedHouseholdId && <Check className="w-4 h-4 shrink-0" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenSettings(h.id)}
                                    className="w-11 h-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                    aria-label={`${h.name}: Mitglieder & Einstellungen`}
                                >
                                    <Settings2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <form onSubmit={create} className="border-t border-border pt-2 px-1 flex gap-2">
                        <input
                            type="text"
                            placeholder="Neuer Haushalt …"
                            aria-label="Name für neuen Haushalt"
                            maxLength={80}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 min-w-0 text-base sm:text-sm bg-transparent px-2 py-2 outline-none"
                        />
                        <button type="submit" disabled={!name.trim() || creating} className="btn btn-primary w-11 h-11 p-0" aria-label="Haushalt anlegen">
                            {creating ? <Spinner className="text-primary-foreground" /> : <Plus className="w-4 h-4" />}
                        </button>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
