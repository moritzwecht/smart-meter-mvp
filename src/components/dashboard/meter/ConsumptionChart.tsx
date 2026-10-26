"use client";

import { useState } from "react";
import { formatConsumption, formatMonthShort } from "@/lib/meter/format";
import type { MonthBucket } from "@/lib/meter/stats";
import { cn } from "@/lib/utils";

/**
 * Monatsverbrauch als Balkendiagramm (ohne Chart-Bibliothek).
 * Monate, die nur teilweise durch Ablesungen abgedeckt sind, erscheinen heller.
 */
export function ConsumptionChart({ buckets, unit, colorClass }: { buckets: MonthBucket[]; unit: string; colorClass: string }) {
    const [active, setActive] = useState<number | null>(null);
    if (buckets.length === 0) return null;
    const max = Math.max(...buckets.map((b) => b.consumption), 0);
    const shown = active ?? buckets.length - 1;
    const current = buckets[shown];

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-bold">{formatMonthShort(current.month)} {current.month.slice(0, 4)}</span>
                <span className="tabular-nums font-black">
                    {formatConsumption(current.consumption)} {unit}
                    {current.coverage < 0.95 && <span className="font-medium text-muted-foreground"> (Schätzung, {Math.round(current.coverage * 100)} % abgedeckt)</span>}
                </span>
            </div>
            {/* Jeder Balken ist ein Knopf mit Beschriftung – per Tastatur und Screenreader erreichbar */}
            <div className="flex items-end gap-1 h-32" role="group" aria-label="Monatsverbrauch">
                {buckets.map((b, i) => (
                    <button
                        key={b.month}
                        type="button"
                        aria-pressed={i === shown}
                        aria-label={`${formatMonthShort(b.month)} ${b.month.slice(0, 4)}: ${formatConsumption(b.consumption)} ${unit}${b.coverage < 0.95 ? " (Schätzung)" : ""}`}
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
                                b.coverage < 0.95 ? "opacity-40" : "opacity-90",
                                i === shown && "opacity-100 ring-2 ring-foreground/20",
                            )}
                            style={{ height: `${max > 0 ? Math.max((b.consumption / max) * 100, b.consumption > 0 ? 3 : 0) : 0}%` }}
                        />
                    </button>
                ))}
            </div>
            <div className="flex gap-1 text-[9px] font-bold uppercase text-muted-foreground" aria-hidden>
                {buckets.map((b, i) => (
                    <span key={b.month} className="flex-1 text-center truncate">
                        {buckets.length <= 12 || i % 2 === buckets.length % 2 ? formatMonthShort(b.month).slice(0, 3) : ""}
                    </span>
                ))}
            </div>
        </div>
    );
}
