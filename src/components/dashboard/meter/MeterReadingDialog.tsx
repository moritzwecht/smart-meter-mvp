"use client";

import { BarChart3 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FieldLabel } from "@/components/ui/AddTile";
import { Alert } from "@/components/ui/Alert";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { formatConsumption, formatDate, formatReading, METER_TYPE_LABELS, toDateInputValue } from "@/lib/meter/format";
import { canComputeCost, checkReading, consumptionCost, previewReading, type PlausibilityIssue } from "@/lib/meter/stats";
import { formatCurrency, parseDecimal } from "@/lib/numbers";
import type { MeterWithReadings } from "@/lib/offline/hooks";
import { addReading } from "@/lib/offline/repo";

interface MeterReadingDialogProps {
    meter: MeterWithReadings | undefined;
    /** Wechselt bei jedem Öffnen → Formular startet frisch */
    instance?: number;
    onClose: () => void;
    onOpenDetails: (meterId: string) => void;
}

/** Datum aus dem Formular → Zeitpunkt (heute: jetzt, sonst Mittag, damit Zeitzonen nicht den Tag verschieben). */
function readingTimestamp(day: string): string {
    if (day === toDateInputValue(new Date())) return new Date().toISOString();
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

function issueText(issue: PlausibilityIssue, unit: string): string {
    switch (issue.kind) {
        case "future-date":
            return "Das Datum liegt in der Zukunft.";
        case "lower-than-previous":
            return `Der Stand ist niedriger als die vorherige Ablesung (${formatReading(issue.previous)} ${unit}). Tippfehler – oder wurde der Zähler getauscht?`;
        case "unusually-high":
            return `Das wären ${formatConsumption(issue.dailyRate)} ${unit} pro Tag – sonst sind es ca. ${formatConsumption(issue.usualRate)}. Stimmt der Wert?`;
        case "big-jump":
            return `Der Wert ist mehr als dreimal so hoch wie der letzte Stand (${formatReading(issue.previous)} ${unit}). Stimmt der Wert?`;
    }
}

/** Live-Vorschau beim Tippen: Was bedeutet der neue Stand? Fällt ein Tippfehler sofort auf. */
function PreviewLine({ meter, value, day, isReplacement }: { meter: MeterWithReadings; value: string; day: string; isReplacement: boolean }) {
    const parsed = parseDecimal(value);
    if (parsed === null || !day) return <p className="min-h-5" aria-hidden />;
    const preview = previewReading(meter.readings, { value: parsed, date: readingTimestamp(day), isReplacement });
    if (!preview) return <p className="min-h-5" aria-hidden />;
    const { consumption, days, perDay } = preview;
    if (consumption < 0) {
        return <p className="min-h-5 text-xs font-medium text-amber-700 dark:text-amber-400">Niedriger als der letzte Stand – Tippfehler oder Zählerwechsel?</p>;
    }
    const rounded = Math.round(days);
    const span = rounded >= 1 ? ` in ${rounded} ${rounded === 1 ? "Tag" : "Tagen"}` : " seit der letzten Ablesung";
    const cost = canComputeCost(meter) && consumption > 0 ? consumptionCost(meter, consumption) : null;
    return (
        <p className="min-h-5 text-xs text-muted-foreground tabular-nums">
            <span className="font-bold text-foreground">
                +{formatReading(consumption)} {meter.unit}
            </span>
            {span}
            {perDay !== null && ` · ≈ ${formatConsumption(perDay)} ${meter.unit}/Tag`}
            {cost !== null && ` · ≈ ${formatCurrency(cost)}`}
        </p>
    );
}

function ReadingForm({ meter, onDone, onOpenDetails }: { meter: MeterWithReadings; onDone: () => void; onOpenDetails: () => void }) {
    const [value, setValue] = useState("");
    const [day, setDay] = useState(() => toDateInputValue(new Date()));
    const [isReplacement, setIsReplacement] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);
    const [error, setError] = useState("");

    const lastReading = meter.readings[meter.readings.length - 1];

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        const parsed = parseDecimal(value);
        if (parsed === null) {
            setError("Bitte gib einen gültigen Zählerstand ein (z. B. 12345,6).");
            return;
        }
        if (!day) {
            setError("Bitte wähle ein Datum.");
            return;
        }
        const candidate = { value: parsed, date: readingTimestamp(day), isReplacement };
        const issue = checkReading(meter.readings, candidate);
        if (issue?.kind === "future-date") {
            setError(issueText(issue, meter.unit));
            return;
        }
        const text = issue ? issueText(issue, meter.unit) : null;
        if (text && warning !== text) {
            setWarning(text); // zweiter Klick auf "Speichern" bestätigt
            return;
        }
        await addReading(meter.id, candidate);
        onDone();
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            {lastReading && (
                <div className="flex justify-between items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>Letzter Stand</span>
                    <span className="tabular-nums text-right">
                        {formatReading(lastReading.value)} {meter.unit} · {formatDate(lastReading.date)}
                    </span>
                </div>
            )}

            <div className="relative">
                <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    aria-label={`Zählerstand in ${meter.unit}`}
                    placeholder="0,00"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value.replace(/[^0-9,.]/g, ""));
                        setWarning(null);
                    }}
                    className="w-full input-field py-5 pr-16 text-4xl font-black tabular-nums"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground uppercase pointer-events-none">
                    {meter.unit}
                </div>
            </div>
            {lastReading && (
                <div className="-mt-3">
                    <PreviewLine meter={meter} value={value} day={day} isReplacement={isReplacement} />
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-2">
                    <FieldLabel htmlFor="reading-date">Datum</FieldLabel>
                    <input
                        id="reading-date"
                        type="date"
                        value={day}
                        max={toDateInputValue(new Date())}
                        onChange={(e) => {
                            setDay(e.target.value);
                            setWarning(null);
                        }}
                        className="input-field w-full"
                    />
                </div>
                <label className="flex items-center gap-2 pb-3 text-xs font-medium cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={isReplacement}
                        onChange={(e) => {
                            setIsReplacement(e.target.checked);
                            setWarning(null);
                        }}
                        className="w-4 h-4 accent-current"
                    />
                    Neuer Zähler (Zählerwechsel)
                </label>
            </div>

            {warning && <Alert variant="warning">{warning} Zum Speichern erneut tippen.</Alert>}
            {error && <Alert variant="error">{error}</Alert>}

            <button type="submit" className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black">
                {warning ? "Trotzdem speichern" : "Speichern"}
            </button>

            <div className="text-center">
                <button
                    type="button"
                    onClick={onOpenDetails}
                    className="inline-flex items-center gap-2 py-2 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-accent rounded-lg"
                >
                    <BarChart3 className="w-3 h-3" />
                    Statistik, Verlauf & Einstellungen
                </button>
            </div>
        </form>
    );
}

export function MeterReadingDialog({ meter, instance, onClose, onOpenDetails }: MeterReadingDialogProps) {
    return (
        <BaseDialog isOpen={!!meter} onClose={onClose} title={meter ? `${METER_TYPE_LABELS[meter.type]} ablesen` : undefined} className="sm:max-w-sm">
            {meter && <ReadingForm key={`${meter.id}:${instance}`} meter={meter} onDone={onClose} onOpenDetails={() => onOpenDetails(meter.id)} />}
        </BaseDialog>
    );
}
