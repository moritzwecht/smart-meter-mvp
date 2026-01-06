"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { parseSafe, formatNumber } from "@/lib/utils";

interface EfficiencyDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    meters: any[];
}

export function EfficiencyDetailsDialog({
    isOpen,
    onClose,
    meters,
}: EfficiencyDetailsDialogProps) {
    const getMeterStats = (meter: any) => {
        const expected = parseSafe(meter.expectedDailyAverage);
        const readings = [...(meter.readings || [])].sort(
            (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        let actual = 0;
        if (readings.length >= 2) {
            const first = readings[0];
            const last = readings[readings.length - 1];
            const diff = parseSafe(last.value) - parseSafe(first.value);
            const ms = new Date(last.date).getTime() - new Date(first.date).getTime();
            const days = ms / (1000 * 60 * 60 * 24);
            actual = days > 0 ? diff / days : 0;
        }

        const ratio = expected > 0 ? (actual / expected) * 100 : null;
        return { actual, expected, ratio };
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Effizienz-Details</h2>
                                <p className="text-xs text-muted-foreground mt-1">Analyse deiner Zählerstände</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {meters.map((meter) => {
                                const { actual, expected, ratio } = getMeterStats(meter);
                                const isGood = ratio !== null && ratio <= 110;
                                const isWarning = ratio !== null && ratio > 110 && ratio <= 140;
                                const isBad = ratio !== null && ratio > 140;

                                return (
                                    <div key={meter.id} className="bg-accent/20 p-4 rounded-2xl flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center",
                                            isGood ? "bg-emerald-500/10 text-emerald-500" :
                                                isWarning ? "bg-amber-500/10 text-amber-500" :
                                                    isBad ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
                                        )}>
                                            {isGood ? <CheckCircle2 className="w-6 h-6" /> :
                                                isWarning ? <AlertTriangle className="w-6 h-6" /> :
                                                    isBad ? <XCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black uppercase tracking-widest opacity-50">{meter.name}</div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-bold">{formatNumber(actual, 2)}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground">{meter.unit}/Tag</span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-[10px] font-bold uppercase opacity-30">Zielwert</div>
                                            <div className="text-xs font-mono font-bold">
                                                {expected > 0 ? formatNumber(expected, 2) : "---"}
                                            </div>
                                            {ratio !== null && (
                                                <div className={cn(
                                                    "text-[10px] font-black",
                                                    isGood ? "text-emerald-500" : isWarning ? "text-amber-500" : "text-red-500"
                                                )}>
                                                    {formatNumber(ratio, 0)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {meters.length === 0 && (
                                <div className="py-12 text-center">
                                    <p className="text-sm text-muted-foreground italic">Keine Zähler vorhanden.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-accent/10 border-t border-border">
                            <button
                                onClick={onClose}
                                className="w-full bg-accent hover:bg-accent/80 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Schließen
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
