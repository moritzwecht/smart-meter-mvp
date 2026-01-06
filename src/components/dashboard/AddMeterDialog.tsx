"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Droplets, Flame } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface AddMeterDialogProps {
    isOpen: boolean;
    onClose: () => void;
    newMeterData: any;
    setNewMeterData: (data: any) => void;
    onAdd: () => void;
    isPending?: boolean;
}

export function AddMeterDialog({
    isOpen,
    onClose,
    newMeterData,
    setNewMeterData,
    onAdd,
    isPending,
}: AddMeterDialogProps) {
    const types = [
        { type: "ELECTRICITY", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", label: "Strom" },
        { type: "WATER", icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10", label: "Wasser" },
        { type: "GAS", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10", label: "Gas" },
    ] as const;

    const units = ["kWh", "m³", "l"];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
                    >
                        <div className="flex justify-between items-center p-3 border-b border-border">
                            <h2 className="text-xl font-black tracking-tight">Neuer Zähler</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-full transition-colors"
                                aria-label="Schließen"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Typ</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {types.map((t) => (
                                            <button
                                                key={t.type}
                                                onClick={() => setNewMeterData({ ...newMeterData, type: t.type, name: t.label })}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${newMeterData.type === t.type
                                                    ? "border-primary bg-primary/5"
                                                    : "border-transparent bg-accent/30 hover:bg-accent/50"
                                                    } `}
                                            >
                                                <t.icon className={`w-6 h-6 ${t.color}`} />
                                                <span className="text-[10px] font-bold uppercase">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Einheit</label>
                                    <div className="flex flex-wrap gap-2">
                                        {units.map((u) => (
                                            <button
                                                key={u}
                                                onClick={() => setNewMeterData({ ...newMeterData, unit: u })}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${newMeterData.unit === u
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                    : "bg-accent/50 hover:bg-accent text-muted-foreground"
                                                    } `}
                                            >
                                                {u}
                                            </button>
                                        ))}
                                        <div className="relative flex-1 min-w-[100px]">
                                            <input
                                                type="text"
                                                placeholder="Andere..."
                                                value={units.includes(newMeterData.unit) ? "" : newMeterData.unit}
                                                onChange={(e) => setNewMeterData({ ...newMeterData, unit: e.target.value })}
                                                className={`w-full input-field font-bold ${!units.includes(newMeterData.unit) && newMeterData.unit !== ""
                                                    ? "border-primary/50"
                                                    : ""
                                                    } `}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onAdd}
                                disabled={isPending}
                                className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black disabled:opacity-70"
                            >
                                {isPending ? <Spinner className="text-primary-foreground" size={20} /> : "Erstellen"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
