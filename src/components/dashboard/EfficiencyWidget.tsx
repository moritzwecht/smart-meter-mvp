"use client";

import { motion } from "framer-motion";
import { Settings, BarChart3, Info } from "lucide-react";
import { parseSafe, formatNumber, cn } from "@/lib/utils";

interface EfficiencyWidgetProps {
    household: any;
    meters: any[];
    onOpenSettings: () => void;
    onOpenDetails: () => void;
}

export function EfficiencyWidget({
    household,
    meters,
    onOpenSettings,
    onOpenDetails,
}: EfficiencyWidgetProps) {
    const calculateTotalEfficiency = () => {
        let totalActual = 0;
        let totalExpected = 0;

        meters.forEach((meter) => {
            const expected = parseSafe(meter.expectedDailyAverage);
            if (expected <= 0) return;

            const readings = [...(meter.readings || [])].sort(
                (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            if (readings.length >= 2) {
                const first = readings[0];
                const last = readings[readings.length - 1];
                const diff = parseSafe(last.value) - parseSafe(first.value);
                const ms = new Date(last.date).getTime() - new Date(first.date).getTime();
                const days = ms / (1000 * 60 * 60 * 24);
                const actual = days > 0 ? diff / days : 0;

                totalActual += actual;
                totalExpected += expected;
            }
        });

        if (totalExpected <= 0) return null;
        return (totalActual / totalExpected) * 100;
    };

    const ratio = calculateTotalEfficiency();

    const getEfficiencyRating = (ratio: number) => {
        if (ratio < 80) return { letter: "A", label: "Exzellent", color: "bg-emerald-600", text: "text-emerald-600" };
        if (ratio < 95) return { letter: "B", label: "Gut", color: "bg-emerald-500", text: "text-emerald-500" };
        if (ratio < 110) return { letter: "C", label: "Gut", color: "bg-green-400", text: "text-green-400" };
        if (ratio < 125) return { letter: "D", label: "Mittel", color: "bg-yellow-400", text: "text-yellow-400" };
        if (ratio < 140) return { letter: "E", label: "Mittel", color: "bg-orange-400", text: "text-orange-400" };
        if (ratio < 160) return { letter: "F", label: "Schlecht", color: "bg-red-400", text: "text-red-400" };
        return { letter: "G", label: "Verschwenderisch", color: "bg-red-600", text: "text-red-600" };
    };

    const rating = ratio !== null ? getEfficiencyRating(ratio) : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-foreground/5"
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xl",
                    rating?.color || "bg-accent"
                )}>
                    {rating?.letter || "?"}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-30">Effizienz</div>
                    {rating ? (
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white",
                                rating.color
                            )}>
                                {rating.letter}
                            </div>
                            <div className={cn("text-xs font-bold uppercase", rating.text)}>
                                {rating.label}
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] text-muted-foreground italic uppercase">
                            Daten benötigt...
                        </p>
                    )}
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onOpenDetails}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                    <BarChart3 className="w-3 h-3" />
                    Details
                </button>
                <button
                    onClick={onOpenSettings}
                    className="p-2 hover:bg-accent rounded-xl transition-colors text-muted-foreground hover:text-primary"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
