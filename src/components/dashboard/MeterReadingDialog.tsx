"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Settings } from "lucide-react";
import { parseSafe, formatNumber } from "@/lib/utils";

interface MeterReadingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    meter: any;
    value: string;
    setValue: (val: string) => void;
    onSave: (e: React.FormEvent) => void;
    onOpenSettings: () => void;
}

export function MeterReadingDialog({
    isOpen,
    onClose,
    meter,
    value,
    setValue,
    onSave,
    onOpenSettings,
}: MeterReadingDialogProps) {
    if (!meter) return null;

    const sortedReadings = [...(meter.readings || [])].sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastReading = sortedReadings[0];

    const typeLabel =
        { ELECTRICITY: "Strom", WATER: "Wasser", GAS: "Gas" }[
        meter.type as "ELECTRICITY" | "WATER" | "GAS"
        ] || "Zähler";

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
                            <div className="space-y-0.5">
                                <h2 className="text-sm font-black tracking-tight uppercase opacity-40">
                                    {typeLabel}
                                </h2>
                            </div>
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
                                {lastReading && (
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        <span>Letzter Stand</span>
                                        <span>
                                            {formatNumber(parseSafe(lastReading.value), 2)} {meter.unit} (
                                            {new Date(lastReading.date).toLocaleDateString()})
                                        </span>
                                    </div>
                                )}

                                <form onSubmit={onSave} className="space-y-4">
                                    <div className="relative">
                                        <input
                                            autoFocus
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0,00"
                                            value={value}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9,.]/g, "");
                                                setValue(val);
                                            }}
                                            className="w-full bg-accent/20 rounded-xl px-4 py-5 text-4xl font-black outline-none focus:bg-accent/40 transition-colors tabular-nums"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground uppercase">
                                            {meter.unit}
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black"
                                    >
                                        Speichern
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="p-3 border-t border-border bg-accent/10 text-center">
                            <button
                                onClick={onOpenSettings}
                                className="inline-flex items-center gap-2 py-2 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-accent rounded-lg"
                            >
                                <Settings className="w-3 h-3" />
                                Einstellungen & Verlauf
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
