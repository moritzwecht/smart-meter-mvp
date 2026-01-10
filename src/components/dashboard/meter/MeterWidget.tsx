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
        <div
            className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 shadow-sm"
        >
            <div className="flex items-center gap-3 relative">
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                    <config.icon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                    {avg ? (
                        <div className="space-y-2">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black tabular-nums">{avg}</span>
                                <span className="text-[10px] font-bold text-muted-foreground">
                                    {meter.unit}/Tag
                                </span>
                            </div>

                            {type === "WATER" && meter.unit === "m³" && (
                                <div className="flex items-baseline gap-1 pt-1 opacity-70">
                                    <span className="text-sm font-black tabular-nums">{Math.round(parseSafe(avg) * 1000)}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Liter
                                    </span>
                                </div>
                            )}

                            {(type === "ELECTRICITY" || type === "GAS") && meter.monthlyPayment && meter.pricePerUnit && (
                                (() => {
                                    const monthlyPayment = parseSafe(meter.monthlyPayment);
                                    const basicFee = parseSafe(meter.basicFee || "0");
                                    const pricePerUnit = parseSafe(meter.pricePerUnit);

                                    if (pricePerUnit <= 0) return null;

                                    let factor = 1;
                                    // Gas Conversion Logic
                                    if (type === "GAS" && meter.unit === "m³" && meter.priceUnit === "kwh") {
                                        const zNumber = parseSafe(meter.zNumber || "1");
                                        const calorificValue = parseSafe(meter.calorificValue || "1");
                                        factor = zNumber * calorificValue;
                                    }

                                    // Budget in Billing Units (e.g. kWh or m³)
                                    const monthlyTargetBillingUnits = (monthlyPayment - basicFee) / pricePerUnit;

                                    // Target in Meter Units (e.g. m³)
                                    const monthlyTargetMeterUnits = monthlyTargetBillingUnits / factor;

                                    const monthlyActualUnits = parseSafe(avg) * 30.44; // Avg days per month
                                    const percentage = (monthlyActualUnits / monthlyTargetMeterUnits) * 100;

                                    // Scale: 0% to 200%. 100% (Budget) is exactly in the middle.
                                    // Visual Position = percentage / 2.
                                    // Cap at 0% and 100% visual width.
                                    const position = Math.min(Math.max(percentage / 2, 0), 100);

                                    return (
                                        <div className="space-y-1 pt-1">
                                            <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 shadow-inner opacity-80">
                                                {/* Center Marker (Budget Limit) */}
                                                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-background/50" />

                                                {/* Current Value Marker */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-foreground rounded-full shadow-lg border border-background transition-all duration-500"
                                                    style={{ left: `calc(${position}% - 3px)` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                <span>{Math.round(percentage)}%</span>
                                                <span>{percentage > 100 ? "Über Budget" : "Im Rahmen"}</span>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
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
                        className={`p-2 rounded-xl ${meter.isPinned === "true"
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
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/20"
                >
                    <Plus className="w-3 h-3" />
                    Eintragen
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditMeter(meter);
                    }}
                    className="p-2 hover:bg-accent rounded-xl text-muted-foreground hover:text-primary"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
