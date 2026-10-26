"use client";

import { BarChart3, Droplets, Flame, Plus, Zap } from "lucide-react";
import { memo, useMemo } from "react";
import { formatConsumption, formatReading, formatRelativeDay, METER_TYPE_LABELS } from "@/lib/meter/format";
import { dailyAverage, projectBillingPeriod, recentDailyAverage, toSegments } from "@/lib/meter/stats";
import { formatCurrency } from "@/lib/numbers";
import type { MeterWithReadings } from "@/lib/offline/hooks";
import { PinButton } from "@/components/ui/PinButton";
import { cn } from "@/lib/utils";

export const METER_ICONS = {
    ELECTRICITY: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
    WATER: { icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10" },
    GAS: { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" },
} as const;

interface MeterWidgetProps {
    meter: MeterWithReadings;
    onAddReading: (meterId: string) => void;
    onOpen: (meterId: string) => void;
    onTogglePin: (meterId: string, pinned: boolean) => void;
}

export const MeterWidget = memo(function MeterWidget({ meter, onAddReading, onOpen, onTogglePin }: MeterWidgetProps) {
    const config = METER_ICONS[meter.type] ?? METER_ICONS.ELECTRICITY;
    const Icon = config.icon;

    const stats = useMemo(() => {
        const { segments } = toSegments(meter.readings);
        const recent = recentDailyAverage(segments, 30);
        const overall = dailyAverage(segments);
        return {
            perDay: recent ?? overall,
            projection: projectBillingPeriod(meter, segments),
        };
    }, [meter]);

    const lastReading = meter.readings[meter.readings.length - 1];
    const projection = stats.projection;
    const budgetRatio =
        projection?.projectedCost != null && projection.payments ? projection.projectedCost / projection.payments : null;

    return (
        <div className="bg-card text-card-foreground rounded-lg border border-border flex flex-col p-3 gap-3 shadow-sm">
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => onOpen(meter.id)}
                    className="flex gap-3 flex-1 min-w-0 text-left"
                >
                    <span className="sr-only">{METER_TYPE_LABELS[meter.type]}:</span>
                    <div className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", config.bg)}>
                        <Icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                        {stats.perDay !== null ? (
                            <>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black tabular-nums">{formatConsumption(stats.perDay)}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground">{meter.unit}/Tag</span>
                                </div>
                                {meter.type === "WATER" && meter.unit === "m³" && (
                                    <div className="flex items-baseline gap-1 opacity-70">
                                        <span className="text-sm font-black tabular-nums">{formatConsumption(stats.perDay * 1000)}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground tracking-wider">Liter/Tag</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider pt-1">
                                {METER_TYPE_LABELS[meter.type]} · {meter.readings.length === 0 ? "Noch keine Ablesung" : "Zweite Ablesung nötig"}
                            </p>
                        )}
                        {lastReading && (
                            <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                                {formatReading(lastReading.value)} {meter.unit} · {formatRelativeDay(lastReading.date)}
                            </p>
                        )}
                    </div>
                </button>

                <PinButton large pinned={meter.isPinned} name={METER_TYPE_LABELS[meter.type]} onToggle={() => onTogglePin(meter.id, !meter.isPinned)} />
            </div>

            {budgetRatio !== null && projection?.balance != null && (
                <div className="space-y-1">
                    <div
                        className="relative h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 opacity-80"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={200}
                        aria-valuenow={Math.round(budgetRatio * 100)}
                        aria-label="Prognose im Verhältnis zu den Abschlägen"
                    >
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-background/60" />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-foreground rounded-full shadow-lg border border-background transition-all duration-500"
                            style={{ left: `calc(${Math.min(Math.max(budgetRatio * 50, 0), 100)}% - 3px)` }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>{Math.round(budgetRatio * 100)} % der Abschläge</span>
                        <span className={projection.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                            {projection.balance >= 0 ? "≈ " : "≈ −"}
                            {formatCurrency(Math.abs(projection.balance))} {projection.balance >= 0 ? "Guthaben" : "Nachzahlung"}
                        </span>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onAddReading(meter.id)}
                    className="flex-1 min-h-11 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/20"
                >
                    <Plus className="w-3 h-3" />
                    Eintragen
                </button>
                <button
                    type="button"
                    onClick={() => onOpen(meter.id)}
                    className="w-11 h-11 flex items-center justify-center hover:bg-accent rounded-xl text-muted-foreground hover:text-primary"
                    aria-label="Statistik & Einstellungen"
                >
                    <BarChart3 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});
