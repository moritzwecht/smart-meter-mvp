"use client";

import { BarChart3 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FieldLabel } from "@/components/ui/AddTile";
import { Alert } from "@/components/ui/Alert";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { useToast } from "@/components/ui/Toast";
import { formatConsumption, formatDate, formatReading, plausibilityText, toDateInputValue } from "@/lib/meter/format";
import { meterTitle } from "@/lib/meter/names";
import { canComputeCost, checkReading, consumptionCost, previewReading, readingNeighbours, timestampForDay } from "@/lib/meter/stats";
import { formatCurrency, formatNumber, parseDecimal } from "@/lib/numbers";
import type { MeterWithReadings } from "@/lib/offline/hooks";
import { addReading, addReplacement, deleteReading } from "@/lib/offline/repo";
import type { Reading } from "@/lib/sync/types";

interface MeterReadingDialogProps {
    meter: MeterWithReadings | undefined;
    /** Wechselt bei jedem Öffnen → Formular startet frisch */
    instance?: number;
    onClose: () => void;
    onOpenDetails: (meterId: string) => void;
}

/** Verbrauch zwischen zwei Ständen: höchstens eine Nachkommastelle ab 100, sonst zwei. */
export const formatAmount = (value: number) => formatNumber(value, Math.abs(value) >= 100 ? 1 : 2, 0);

/** „7.010“ mit Tausenderpunkt gemeint? Wird als 7,010 gelesen. */
const looksLikeThousandsDot = (raw: string) => /^\d{1,3}\.\d{3}$/.test(raw.trim());

/**
 * Live-Vorschau beim Tippen: Was bedeutet der Stand? Ein Tippfehler fällt so schon vor
 * dem Speichern auf – unplausible Werte werden sofort farbig markiert.
 * Wird auch beim Bearbeiten im Verlauf verwendet (dort ohne die bearbeitete Ablesung).
 */
export function ReadingPreview({
    meter,
    readings,
    raw,
    date,
}: {
    meter: MeterWithReadings;
    readings: readonly Reading[];
    raw: string;
    date: string | null;
}) {
    const [now] = useState(() => Date.now());
    const parsed = parseDecimal(raw);
    if (parsed === null || !date) return <p className="min-h-5" aria-hidden />;
    const candidate = { value: parsed, date, isReplacement: false };
    const issue = checkReading(readings, candidate, now, meter);
    if (issue) {
        const hint =
            looksLikeThousandsDot(raw) && issue.kind === "lower-than-previous"
                ? ` Meintest du ${raw.replace(".", "")}? Tausenderpunkte bitte weglassen, Nachkommastellen mit Komma (z. B. ${raw.replace(".", "")},2).`
                : "";
        return (
            <p className="min-h-5 text-xs font-medium text-amber-800 dark:text-amber-300" role="status">
                {plausibilityText(issue, meter.unit)}
                {hint}
            </p>
        );
    }
    const preview = previewReading(readings, candidate);
    if (!preview || preview.consumption < 0) return <p className="min-h-5" aria-hidden />;
    const { consumption, days, perDay } = preview;
    const rounded = Math.round(days);
    const span = rounded >= 1 ? ` in ${rounded} ${rounded === 1 ? "Tag" : "Tagen"}` : " seit der vorherigen Ablesung";
    const cost = canComputeCost(meter) && consumption > 0 ? consumptionCost(meter, consumption) : null;
    return (
        <p className="min-h-5 text-xs text-muted-foreground tabular-nums">
            <span className="font-bold text-foreground">
                +{formatAmount(consumption)} {meter.unit}
            </span>
            {span}
            {perDay !== null && ` · ≈ ${formatConsumption(perDay)} ${meter.unit}/Tag`}
            {cost !== null && ` · ≈ ${formatCurrency(cost)}`}
        </p>
    );
}

/** Kopfzeile: letzter Stand – beim Nachtragen der Stand davor und danach, mit dem die Vorschau rechnet. */
function ContextLine({ meter, day }: { meter: MeterWithReadings; day: string }) {
    const last = meter.readings[meter.readings.length - 1];
    if (!last) return null;
    const row = (label: string, r: Reading) => (
        <div key={label} className="flex justify-between items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
            <span className="text-xs text-muted-foreground tabular-nums text-right">
                {formatReading(r.value)} {meter.unit} · {formatDate(r.date)}
            </span>
        </div>
    );
    if (!day || day === toDateInputValue(new Date())) return row("Letzter Stand", last);
    const { previous, next } = readingNeighbours(meter.readings, timestampForDay(day, meter.readings));
    return (
        <div className="space-y-1">
            {previous && row("Stand davor", previous)}
            {next && row("Stand danach", next)}
        </div>
    );
}

function ReadingForm({ meter, onDone, onOpenDetails }: { meter: MeterWithReadings; onDone: () => void; onOpenDetails: () => void }) {
    const toast = useToast();
    const [value, setValue] = useState("");
    const [oldFinal, setOldFinal] = useState("");
    const [day, setDay] = useState(() => toDateInputValue(new Date()));
    const [isReplacement, setIsReplacement] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);
    const [error, setError] = useState("");

    const hasReadings = meter.readings.length > 0;
    const date = day ? timestampForDay(day, meter.readings) : null;
    const reset = () => setWarning(null);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        const parsed = parseDecimal(value);
        if (parsed === null) {
            setError(isReplacement ? "Bitte gib den Startstand des neuen Zählers ein (z. B. 0 oder 12,5)." : "Bitte gib einen gültigen Zählerstand ein (z. B. 12345,6).");
            return;
        }
        if (!day || !date) {
            setError("Bitte wähle ein Datum.");
            return;
        }
        const oldValue = isReplacement && oldFinal.trim() ? parseDecimal(oldFinal) : null;
        if (isReplacement && oldFinal.trim() && oldValue === null) {
            setError("Bitte gib den Endstand des alten Zählers als Zahl ein – oder lass das Feld leer.");
            return;
        }
        // Beim Zählerwechsel wird der Endstand des alten Zählers geprüft, der Startstand des neuen nicht
        const checked = !isReplacement
            ? { value: parsed, date, isReplacement: false }
            : oldValue !== null
              ? { value: oldValue, date, isReplacement: false }
              : { value: parsed, date, isReplacement: true };
        const issue = checkReading(meter.readings, checked, Date.now(), meter);
        if (issue?.kind === "future-date") {
            setError(plausibilityText(issue, meter.unit));
            return;
        }
        const text = issue ? plausibilityText(issue, meter.unit) : null;
        if (text && warning !== text) {
            setWarning(text); // zweites Tippen auf "Speichern" bestätigt
            return;
        }

        if (isReplacement) {
            const ids = await addReplacement(meter.id, { date, oldFinal: oldValue, newStart: parsed });
            toast({
                message: `Zählerwechsel gespeichert: neuer Zähler ab ${formatReading(parsed)} ${meter.unit}`,
                variant: "success",
                duration: 6000,
                action: { label: "Rückgängig", onClick: () => void Promise.all(ids.map((id) => deleteReading(id))) },
            });
        } else {
            const preview = previewReading(meter.readings, { value: parsed, date, isReplacement: false });
            const id = await addReading(meter.id, { value: parsed, date, isReplacement: false });
            const delta = preview && preview.consumption >= 0 ? ` (+${formatAmount(preview.consumption)} ${meter.unit} seit ${formatDate(preview.previous.date)})` : "";
            toast({
                message: `Gespeichert: ${formatReading(parsed)} ${meter.unit}${delta}`,
                variant: "success",
                duration: 6000,
                action: { label: "Rückgängig", onClick: () => void deleteReading(id) },
            });
        }
        onDone();
    };

    return (
        // noValidate: eigene, verständliche Meldungen statt der Browser-Blase (z. B. Datum in der Zukunft)
        <form onSubmit={submit} noValidate className="space-y-5">
            <ContextLine meter={meter} day={day} />

            {isReplacement && (
                <div className="space-y-2">
                    <FieldLabel htmlFor="reading-old-final">Endstand alter Zähler (empfohlen)</FieldLabel>
                    <div className="relative">
                        <input
                            id="reading-old-final"
                            type="text"
                            inputMode="decimal"
                            placeholder="Letzter Stand vor dem Ausbau"
                            value={oldFinal}
                            onChange={(e) => {
                                setOldFinal(e.target.value.replace(/[^0-9,.]/g, ""));
                                reset();
                            }}
                            className="w-full input-field pr-16 text-lg font-bold tabular-nums"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">{meter.unit}</span>
                    </div>
                    {oldFinal.trim() ? (
                        <ReadingPreview meter={meter} readings={meter.readings} raw={oldFinal} date={date} />
                    ) : (
                        <p className="text-xs text-muted-foreground">Ohne Endstand fehlt der Verbrauch seit der letzten Ablesung – die App schätzt ihn dann.</p>
                    )}
                </div>
            )}

            <div className="space-y-2">
                {isReplacement && <FieldLabel htmlFor="reading-value">Startstand neuer Zähler</FieldLabel>}
                <div className="relative">
                    <input
                        id="reading-value"
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        aria-label={isReplacement ? undefined : `Zählerstand in ${meter.unit}`}
                        placeholder="0,00"
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value.replace(/[^0-9,.]/g, ""));
                            reset();
                        }}
                        className="w-full input-field py-5 pr-16 text-4xl font-black tabular-nums"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">{meter.unit}</div>
                </div>
                <div className="-mt-1">
                    {isReplacement ? (
                        <p className="text-xs text-muted-foreground">Ab hier zählt der neue Zähler – der Sprung zum Startstand ist kein Verbrauch.</p>
                    ) : hasReadings ? (
                        <ReadingPreview meter={meter} readings={meter.readings} raw={value} date={date} />
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Erster Stand – mit Nachkommastellen, wie auf dem Zähler. Ab der nächsten Ablesung siehst du Verbrauch und Kosten.
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 items-end">
                <div className="space-y-2">
                    <FieldLabel htmlFor="reading-date">Datum</FieldLabel>
                    <input
                        id="reading-date"
                        type="date"
                        value={day}
                        max={toDateInputValue(new Date())}
                        onChange={(e) => {
                            setDay(e.target.value);
                            reset();
                        }}
                        className="input-field w-full"
                    />
                </div>
                {hasReadings && (
                    <label className="flex items-center gap-3 min-h-11 text-xs font-medium cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isReplacement}
                            onChange={(e) => {
                                setIsReplacement(e.target.checked);
                                reset();
                            }}
                            className="w-5 h-5 shrink-0 accent-current"
                        />
                        Zählerwechsel: neuer Zähler eingebaut
                    </label>
                )}
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
                    className="inline-flex items-center gap-2 min-h-11 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-accent rounded-lg"
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
        <BaseDialog isOpen={!!meter} onClose={onClose} title={meter ? `${meterTitle(meter)} ablesen` : undefined} className="sm:max-w-sm">
            {meter && <ReadingForm key={`${meter.id}:${instance}`} meter={meter} onDone={onClose} onOpenDetails={() => onOpenDetails(meter.id)} />}
        </BaseDialog>
    );
}
