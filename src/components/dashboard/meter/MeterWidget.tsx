"use client";

import { motion } from "framer-motion";
import { Zap, Droplets, Flame, Plus, Settings, Pin } from "lucide-react";
import { parseSafe, formatNumber } from "@/lib/utils";

interface MeterWidgetProps {
    meter: any;
    onAddReading: (meter: any) => void;
    onEditMeter: (meter: any) => void;
    onPin?: () => void;
}

export function MeterWidget({ meter, onAddReading, onEditMeter, onPin }: MeterWidgetProps) {
    const type = meter.type || "ELECTRICITY";
    const config = {
        ELECTRICITY: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
        WATER: { icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10" },
        GAS: { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" },
    }[type as "ELECTRICITY" | "WATER" | "GAS"] || {
        icon: Zap,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
    };

    const calculateDailyAverage = () => {
        const sorted = [...(meter.readings || [])].sort(
            (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        if (sorted.length >= 2) {
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const diff = parseSafe(last.value) - parseSafe(first.value);
            const ms = new Date(last.date).getTime() - new Date(first.date).getTime();
            const days = ms / (1000 * 60 * 60 * 24);
            return days > 0 ? formatNumber(diff / days, 2) : null;
        }
        return null;
    };

    const avg = calculateDailyAverage();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-foreground/5"
        >
            <div className="flex items-center gap-3 relative">
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                    <config.icon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                    {avg ? (
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black tabular-nums">{avg}</span>
                            <span className="text-[10px] font-bold text-muted-foreground">
                                {meter.unit}/Tag
                            </span>
                        </div>
                    ) : (
                        <p className="text-[10px] text-muted-foreground italic uppercase">
                            Daten benötigt...
                        </p>
                    )}
                </div>

                {onPin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPin();
                        }}
                        className={`p-2 rounded-xl transition-all duration-300 ${meter.isPinned === "true"
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground/30 hover:text-primary hover:bg-primary/5"
                            }`}
                    >
                        <Pin className={`w-4 h-4 ${meter.isPinned === "true" ? "fill-current" : ""}`} />
                    </button>
                )}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => onAddReading(meter)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/20"
                >
                    <Plus className="w-3 h-3" />
                    Eintragen
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditMeter(meter);
                    }}
                    className="p-2 hover:bg-accent rounded-xl transition-colors text-muted-foreground hover:text-primary"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
