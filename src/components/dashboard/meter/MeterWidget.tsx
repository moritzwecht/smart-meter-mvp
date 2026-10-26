"use client";

import { AlertTriangle, BarChart3, Droplets, Flame, Plus, Zap } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { formatConsumption, formatReading, formatRelativeDay } from "@/lib/meter/format";
import { meterTitle } from "@/lib/meter/names";
import { DAY_MS, projectBillingPeriod, recentDailyAverage, dailyAverage, toSegments } from "@/lib/meter/stats";
import { formatCurrency } from "@/lib/numbers";
import type { MeterWithReadings } from "@/lib/offline/hooks";
import { PinButton } from "@/components/ui/PinButton";
import { cn } from "@/lib/utils";

export const METER_ICONS = {
    ELECTRICITY: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
    WATER: { icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10" },
    GAS: { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" },
} as const;

/** Ab so vielen Tagen ohne Ablesung wirkt der Ø veraltet */
const STALE_DAYS = 45;

interface MeterWidgetProps {
    meter: MeterWithReadings;
    onAddReading: (meterId: string) => void;
    onOpen: (meterId: string) => void;
    onTogglePin: (meterId: string, pinned: boolean) => void;
}

export const MeterWidget = memo(function MeterWidget({ meter, onAddReading, onOpen, onTogglePin }: MeterWidgetProps) {
    const config = METER_ICONS[meter.type] ?? METER_ICONS.ELECTRICITY;
    const Icon = config.icon;
    const title = meterTitle(meter);

    const stats = useMemo(() => {
        const { segments, anomalies } = toSegments(meter.readings);
        const recent = recentDailyAverage(segments, 30);
        const overall = dailyAverage(segments);
        return {
            perDay: recent ?? overall,
            anomalies,
            projection: projectBillingPeriod(meter, segments),
        };
    }, [meter]);

    const [now] = useState(() => Date.now());
    const lastReading = meter.readings[meter.readings.length - 1];
    const stale = !!lastReading && now - Date.parse(lastReading.date) > STALE_DAYS * DAY_MS;
    const projection = stats.projection;
    const budgetRatio = projection?.projectedCost != null && projection.payments ? projection.projectedCost / projection.payments : null;
    const balance = projection?.balance ?? null;
    const balanceText =
        balance !== null ? `≈ ${formatCurrency(Math.abs(balance), { whole: true })} ${balance >= 0 ? "Guthaben" : "Nachzahlung"}` : "";

    return (
        <section aria-label={title} className="bg-card text-card-foreground rounded-lg border border-border flex flex-col p-3 gap-3 shadow-sm">
            <div className="flex gap-3">
                <button type="button" onClick={() => onOpen(meter.id)} className="flex gap-3 flex-1 min-w-0 text-left">
                    <div className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", config.bg)} aria-hidden>
                        <Icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-bold text-muted-foreground truncate">{title}</p>
                        {stats.perDay !== null ? (
                            <>
                                <div className={cn("flex items-baseline gap-1", stale && "opacity-60")}>
                                    <span className="text-xl font-black tabular-nums">{formatConsumption(stats.perDay)}</span>
                                    <span className="text-xs font-bold text-muted-foreground">
                                        {meter.unit}/Tag<span className="sr-only"> im Durchschnitt</span>
                                    </span>
                                </div>
                                {meter.type === "WATER" && meter.unit === "m³" && (
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-sm font-black tabular-nums text-muted-foreground">{formatConsumption(stats.perDay * 1000)}</span>
                                        <span className="text-xs font-bold text-muted-foreground">Liter/Tag</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-xs text-muted-foreground pt-1">
                                {meter.readings.length === 0
                                    ? "Noch keine Ablesung"
                                    : meter.readings.length === 1
                                      ? "Nächste Ablesung zeigt den Verbrauch"
                                      : "Verbrauch ab einem Tag Abstand"}
                            </p>
                        )}
                        {lastReading && (
                            <p className="text-xs text-muted-foreground tabular-nums truncate">
                                {formatReading(lastReading.value)} {meter.unit} · {formatRelativeDay(lastReading.date)}
                            </p>
                        )}
                    </div>
                </button>

                <PinButton large pinned={meter.isPinned} name={title} onToggle={() => onTogglePin(meter.id, !meter.isPinned)} />
            </div>

            {(stale || stats.anomalies > 0) && (
                <button
                    type="button"
                    onClick={() => onOpen(meter.id)}
                    className="flex items-center gap-2 min-h-11 -my-1 px-2 rounded-lg bg-amber-500/10 text-xs font-medium text-amber-800 dark:text-amber-300 text-left"
                >
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                    {stats.anomalies > 0
                        ? `${stats.anomalies === 1 ? "1 Ablesung" : `${stats.anomalies} Ablesungen`} prüfen`
                        : `Letzte Ablesung ${formatRelativeDay(lastReading!.date)} – jetzt ablesen?`}
                </button>
            )}

            {budgetRatio !== null && balance !== null && (
                <div className="space-y-1.5">
                    <div
                        className="relative h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 opacity-80"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={200}
                        aria-valuenow={Math.min(Math.round(budgetRatio * 100), 200)}
                        aria-valuetext={`Prognose ${Math.round(budgetRatio * 100)} % der Abschläge, ${balanceText}${projection?.uncertain ? ", grobe Schätzung" : ""}`}
                        aria-label="Prognose im Verhältnis zu den Abschlägen"
                    >
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-background/60" />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-foreground rounded-full shadow-lg border border-background transition-all duration-500"
                            style={{ left: `calc(${Math.min(Math.max(budgetRatio * 50, 0), 100)}% - 3px)` }}
                        />
                    </div>
                    <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-0.5 text-xs" aria-hidden>
                        <span className="text-muted-foreground">
                            Prognose: {Math.round(budgetRatio * 100)} % der Abschläge
                            {projection?.uncertain && " (grobe Schätzung)"}
                        </span>
                        <span className={cn("font-bold", balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{balanceText}</span>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onAddReading(meter.id)}
                    aria-label={`${title}: Ablesung eintragen`}
                    className="flex-1 min-h-11 bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-lg shadow-emerald-700/20"
                >
                    <Plus className="w-3 h-3" aria-hidden />
                    Eintragen
                </button>
                <button
                    type="button"
                    onClick={() => onOpen(meter.id)}
                    className="w-11 h-11 flex items-center justify-center hover:bg-accent rounded-xl text-muted-foreground hover:text-primary"
                    aria-label={`${title}: Statistik & Einstellungen`}
                >
                    <BarChart3 className="w-4 h-4" />
                </button>
            </div>
        </section>
    );
});
