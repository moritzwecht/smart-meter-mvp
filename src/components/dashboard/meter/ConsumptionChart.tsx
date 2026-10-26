"use client";

import { useState } from "react";
import { formatConsumption, formatDate, formatMonthShort } from "@/lib/meter/format";
import type { MonthBucket } from "@/lib/meter/stats";
import { cn } from "@/lib/utils";

/** Ab so viel Abdeckung gilt ein Monat als vollständig abgelesen */
const FULL = 0.95;

/**
 * Monatsverbrauch als Balkendiagramm (ohne Chart-Bibliothek).
 * Monate, die nur teilweise abgelesen sind, erscheinen immer hell – auch wenn sie
 * ausgewählt sind (die Auswahl zeigt ein Rahmen). Ihr Wert ist der erfasste Verbrauch,
 * keine Hochrechnung.
 */
export function ConsumptionChart({ buckets, unit, colorClass, until }: { buckets: MonthBucket[]; unit: string; colorClass: string; until: number }) {
    const [active, setActive] = useState<number | null>(null);
    if (buckets.length === 0) return null;
    const max = Math.max(...buckets.map((b) => b.consumption), 0);
    const shown = active ?? buckets.length - 1;
    const current = buckets[shown];
    const isLast = (i: number) => i === buckets.length - 1;
    /** „bisher, bis 24.10.2026“ für den letzten Monat, sonst „nur teilweise abgelesen“ */
    const partialText = (b: MonthBucket, i: number) =>
        b.coverage >= FULL ? "" : isLast(i) ? `bisher, bis ${formatDate(until)}` : "nur teilweise abgelesen";
    const hasPartial = buckets.some((b) => b.coverage < FULL);

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-bold">
                    {formatMonthShort(current.month)} {current.month.slice(0, 4)}
                </span>
                <span className="tabular-nums font-black text-right">
                    {formatConsumption(current.consumption)} {unit}
                    {current.coverage < FULL && <span className="font-medium text-muted-foreground"> ({partialText(current, shown)})</span>}
                </span>
            </div>
            {/* Jeder Balken ist ein Knopf mit Beschriftung – per Tastatur und Screenreader erreichbar */}
            <div className="flex items-end gap-1 h-32" role="group" aria-label="Monatsverbrauch">
                {buckets.map((b, i) => {
                    const partial = b.coverage < FULL;
                    return (
                        <button
                            key={b.month}
                            type="button"
                            aria-pressed={i === shown}
                            aria-label={`${formatMonthShort(b.month)} ${b.month.slice(0, 4)}: ${formatConsumption(b.consumption)} ${unit}${partial ? ` (${partialText(b, i)})` : ""}`}
                            // Hover nur mit Maus – auf Touch-Geräten würde er das Antippen überlagern
                            onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
                            onFocus={() => setActive(i)}
                            onClick={() => setActive(i === active ? null : i)}
                            className="flex-1 h-full flex flex-col justify-end group rounded-t-md outline-offset-2"
                        >
                            <div
                                className={cn(
                                    "w-full rounded-t-md transition-all",
                                    colorClass,
                                    partial ? "opacity-40" : "opacity-90",
                                    i === shown && "ring-2 ring-offset-1 ring-foreground/60 ring-offset-background",
                                )}
                                style={{ height: `${max > 0 ? Math.max((b.consumption / max) * 100, b.consumption > 0 ? 3 : 0) : 0}%` }}
                            />
                        </button>
                    );
                })}
            </div>
            <div className="flex gap-1 text-[9px] font-bold uppercase text-muted-foreground" aria-hidden>
                {buckets.map((b, i) => (
                    <span key={b.month} className="flex-1 text-center truncate">
                        {buckets.length <= 12 || i % 2 === buckets.length % 2 ? formatMonthShort(b.month).slice(0, 3) : ""}
                    </span>
                ))}
            </div>
            {hasPartial && (
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className={cn("inline-block w-3 h-3 rounded-sm opacity-40", colorClass)} aria-hidden />
                    Hell = Monat nicht vollständig abgelesen
                </p>
            )}
        </div>
    );
}
