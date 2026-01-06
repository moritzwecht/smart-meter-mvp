"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, ListTodo, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddWidgetMenuProps {
    isOpen: boolean;
    isPending?: boolean;
    onAddWidget: (type: "METER" | "LIST" | "NOTE" | "EFFICIENCY") => void;
}

export function AddWidgetMenu({ isOpen, isPending, onAddWidget }: AddWidgetMenuProps) {
    const options = [
        { type: "METER", icon: <Zap className="w-5 h-5" />, label: "Zähler", desc: "Strom, Gas, Wasser" },
        { type: "EFFICIENCY", icon: <BarChart3 className="w-5 h-5" />, label: "Effizienz", desc: "Barometer & Trends" },
        { type: "LIST", icon: <ListTodo className="w-5 h-5" />, label: "Liste (Beta)", desc: "Aufgaben & Pläne" },
        { type: "NOTE", icon: <FileText className="w-5 h-5" />, label: "Notiz (Beta)", desc: "Schnelle Gedanken" },
    ] as const;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-8">
                        {options.map((opt) => (
                            <motion.button
                                key={opt.type}
                                whileTap={isPending ? {} : { scale: 0.95 }}
                                onClick={() => onAddWidget(opt.type)}
                                disabled={isPending}
                                className={cn(
                                    "bg-card text-card-foreground rounded-lg border border-border p-3 hover:border-primary/50 group text-left flex flex-col items-start gap-3 transition-opacity",
                                    isPending && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <div className="p-3 rounded-xl bg-accent group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    {opt.icon}
                                </div>
                                <div>
                                    <div className="font-bold text-sm uppercase tracking-tight">{opt.label}</div>
                                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
