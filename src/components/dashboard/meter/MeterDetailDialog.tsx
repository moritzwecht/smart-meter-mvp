"use client";

import { ArrowLeft, ChevronDown, Download, History, Pencil, RefreshCw, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FieldLabel } from "@/components/ui/AddTile";
import { Alert } from "@/components/ui/Alert";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatConsumption, formatDate, formatDelta, formatReading, formatRelativeDay, METER_TYPE_LABELS, plausibilityText, toDateInputValue } from "@/lib/meter/format";
import { customMeterName, meterTitle } from "@/lib/meter/names";
import {
    billingFactor,
    canComputeCost,
    checkReading,
    consumptionBetween,
    consumptionCost,
    conversionMissing,
    dailyAverage,
    DAY_MS,
    DAYS_PER_MONTH,
    isCubicMeters,
    measuredMs,
    MIN_PROJECTION_DAYS,
    monthlyConsumption,
    needsConversion,
    priceLooksTooHigh,
    projectBillingPeriod,
    readingFlags,
    recentDailyAverage,
    timestampForDay,
    toSegments,
} from "@/lib/meter/stats";
import { readingsToCsv, shareOrDownloadCsv } from "@/lib/meter/export";
import { formatCurrency, formatNumber, parseDecimal, toInputValue } from "@/lib/numbers";
import type { MeterWithReadings } from "@/lib/offline/hooks";
import { addReading, deleteMeter, deleteReading, updateMeter, updateReading } from "@/lib/offline/repo";
import type { Reading } from "@/lib/sync/types";
import { cn } from "@/lib/utils";
import { ConsumptionChart } from "./ConsumptionChart";
import { focusFormField, MeterCostFields, meterFieldsFromForm, meterFormFromFields, MeterTypeFields, type MeterFormError, type MeterFormState } from "./MeterForm";
import { NO_FINAL_HINT, ReadingPreview, readingsUntil } from "./MeterReadingDialog";
import { METER_ICONS } from "./MeterWidget";

const CHART_COLORS = { ELECTRICITY: "bg-amber-500", WATER: "bg-blue-500", GAS: "bg-orange-500" } as const;

/** Ab so vielen Tagen ohne Ablesung gilt der Stand als veraltet */
export const STALE_DAYS = 45;

/** „Ø“ liest mancher Screenreader als „Durchmesser“ */
const Avg = () => (
    <>
        <span aria-hidden>Ø</span>
        <span className="sr-only">Durchschnitt</span>
    </>
);

/** Geld: ganze Beträge ohne Cent, sonst mit */
const money = (value: number) => formatCurrency(value, { whole: Number.isInteger(value) });

function Stat({ label, value, hint, tone, wide }: { label: ReactNode; value: string; hint?: ReactNode; tone?: "good" | "bad"; wide?: boolean }) {
    return (
        <div className={cn("p-3 bg-accent/30 rounded-2xl space-y-1 border-2 border-border/50 min-w-0", wide && "col-span-2")}>
            <dt className="text-[11px] font-bold text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    "text-xl font-black tabular-nums truncate",
                    tone === "good" && "text-emerald-700 dark:text-emerald-400",
                    tone === "bad" && "text-red-700 dark:text-red-400",
                )}
            >
                {value}
            </dd>
            {hint && <dd className="text-xs text-muted-foreground leading-snug">{hint}</dd>}
        </div>
    );
}

const BASIS_TEXT = {
    "last-year": "Rest wie im Vorjahr",
    profile: "Rest nach typischem Gasverlauf (Winter mehr)",
    average: "Rest nach deinem bisherigen Schnitt",
} as const;

function Notice({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
    return (
        <li className="flex flex-col gap-2 p-3 rounded-xl border-2 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-sm text-amber-800 dark:text-amber-300">
            <span>{children}</span>
            {action && onAction && (
                <button type="button" onClick={onAction} className="self-start min-h-11 px-3 rounded-lg bg-amber-500/15 font-bold text-amber-900 dark:text-amber-200">
                    {action}
                </button>
            )}
        </li>
    );
}

type EditRequest = { id: string; preset?: "replacement" };

function Statistics({ meter, onOpenSettings, onFix }: { meter: MeterWithReadings; onOpenSettings: () => void; onFix: (edit: EditRequest) => void }) {
    const [now] = useState(() => Date.now());
    const stats = useMemo(() => {
        const { segments } = toSegments(meter.readings);
        const { flags, previousOf } = readingFlags(meter.readings);
        const last = segments.length ? segments[segments.length - 1].end : null;
        const recentWindow = last !== null ? consumptionBetween(segments, last - 30 * DAY_MS, last).coveredMs / DAY_MS : 0;
        return {
            segments,
            flags,
            previousOf,
            overall: dailyAverage(segments),
            recent: recentDailyAverage(segments, 30),
            recentDays: Math.min(30, Math.round(recentWindow)),
            measuredDays: measuredMs(segments) / DAY_MS,
            firstStart: segments[0]?.start ?? null,
            lastEnd: last,
            months: monthlyConsumption(segments, 12),
            projection: projectBillingPeriod(meter, segments),
        };
    }, [meter]);

    const { unit } = meter;
    const issues = meter.readings.filter((r) => stats.flags.has(r));
    const missingConversion = (meter.pricePerUnit ?? 0) > 0 && conversionMissing(meter);
    const priceTooHigh = priceLooksTooHigh(meter);
    const lastReading = meter.readings[meter.readings.length - 1];
    const stale = !!lastReading && now - Date.parse(lastReading.date) > STALE_DAYS * DAY_MS;
    const factor = needsConversion(meter) && !conversionMissing(meter) ? billingFactor(meter) : null;
    const kwh = (value: number) => (factor ? ` · ≈ ${formatNumber(Math.round(value * factor), 0)} kWh` : "");

    const notices = (issues.length > 0 || missingConversion || priceTooHigh || stale) && (
        <ul className="space-y-2" aria-label="Hinweise">
            {issues.map((r) => {
                const previous = stats.previousOf.get(r);
                return stats.flags.get(r) === "drop" ? (
                    <Notice key={r.id} action="Als Zählerwechsel markieren" onAction={() => onFix({ id: r.id, preset: "replacement" })}>
                        {formatDate(r.date)}: {formatReading(r.value)} {unit} ist niedriger als {previous ? `${formatReading(previous.value)} ${unit}` : "der Stand davor"} –
                        wurde der Zähler getauscht? Solange das offen ist, zählt der Verbrauch
                        {previous ? ` zwischen ${formatDate(previous.date)} und ${formatDate(r.date)}` : " dazwischen"} nicht.
                    </Notice>
                ) : (
                    <Notice key={r.id} action="Korrigieren" onAction={() => onFix({ id: r.id })}>
                        {formatDate(r.date)}: {formatReading(r.value)} {unit} passt nicht zu den übrigen Ständen (Tippfehler?) und zählt nicht mit.
                    </Notice>
                );
            })}
            {missingConversion && (
                <Notice action="Jetzt eintragen" onAction={onOpenSettings}>
                    {isCubicMeters(unit)
                        ? "Für die Kosten fehlen Zustandszahl und Brennwert (der Preis gilt pro kWh, der Zähler misst in m³). Beide stehen auf deiner Gasrechnung."
                        : `Der Preis gilt pro kWh, der Zähler misst aber in ${unit} – das lässt sich nicht umrechnen. Prüf Einheit und Preis.`}
                </Notice>
            )}
            {priceTooHigh && !missingConversion && (
                <Notice action="Preis prüfen" onAction={onOpenSettings}>
                    Der Arbeitspreis von {formatNumber(meter.pricePerUnit ?? 0, 4, 2)} € ist sehr hoch – vermutlich in Cent statt Euro eingetragen.
                </Notice>
            )}
            {stale && (
                <Notice>
                    Letzte Ablesung {formatRelativeDay(lastReading.date)} ({formatDate(lastReading.date)}) – Durchschnitt und Prognose beziehen sich auf die Zeit bis
                    dahin.
                </Notice>
            )}
        </ul>
    );

    if (stats.overall === null) {
        const text =
            meter.readings.length === 0
                ? "Trag deinen ersten Zählerstand ein – ab der zweiten Ablesung siehst du Verbrauch und Prognose."
                : meter.readings.length === 1
                  ? "Noch eine Ablesung, dann siehst du deinen Verbrauch pro Tag."
                  : "Durchschnitt und Prognose erscheinen, sobald zwei Ablesungen mindestens einen Tag auseinanderliegen.";
        return (
            <div className="space-y-4">
                {notices}
                <p className="p-6 text-center bg-accent/20 rounded-2xl border border-dashed border-border text-sm text-muted-foreground">{text}</p>
            </div>
        );
    }

    const p = stats.projection;
    // Preis vermutlich in Cent eingetragen: Beträge wären absurd – nur der Hinweis „Preis prüfen“
    const hasCost = canComputeCost(meter) && !priceTooHigh;
    // Monatskosten wie der Abschlag: Arbeitspreis + Grundgebühr
    const perMonthCost = hasCost && stats.recent !== null ? consumptionCost(meter, stats.recent) * DAYS_PER_MONTH + (meter.basicFee ?? 0) : null;
    const showRecent = stats.recent !== null && stats.recentDays >= 1;
    const showOverall = stats.measuredDays > 31 || !showRecent;

    return (
        <div className="space-y-6">
            {notices}
            <dl className="grid grid-cols-2 gap-3">
                {hasCost && p?.balance != null && (
                    <Stat
                        wide
                        label={p.balance >= 0 ? "Voraussichtliches Guthaben" : "Voraussichtliche Nachzahlung"}
                        value={`≈ ${formatCurrency(Math.abs(p.balance), { whole: true })}`}
                        tone={p.balance >= 0 ? "good" : "bad"}
                        hint={
                            <>
                                bei {money(p.payments! / 12)} Abschlag pro Monat · passend wären ≈ {formatCurrency(p.projectedCost! / 12, { whole: true })}
                                {p.uncertain && " · grobe Schätzung, noch wenige Daten"}
                            </>
                        }
                    />
                )}
                {showRecent && (
                    <Stat
                        label={
                            <>
                                <Avg /> pro Tag ({stats.recentDays === 1 ? "letzter Tag" : `letzte ${stats.recentDays} Tage`})
                            </>
                        }
                        value={`${formatConsumption(stats.recent!)} ${unit}`}
                        hint={
                            <>
                                bis {formatDate(stats.lastEnd!)}
                                {perMonthCost !== null && ` · ≈ ${formatCurrency(perMonthCost, { whole: true })} pro Monat inkl. Grundgebühr`}
                            </>
                        }
                    />
                )}
                {showOverall && (
                    <Stat
                        label={
                            <>
                                <Avg /> pro Tag seit {formatDate(stats.firstStart!)}
                            </>
                        }
                        value={`${formatConsumption(stats.overall)} ${unit}`}
                    />
                )}
                {p && (
                    <>
                        <Stat
                            label={`Bisher (seit ${formatDate(p.periodStart)})`}
                            value={`${formatConsumption(p.consumptionSoFar)} ${unit}`}
                            hint={
                                <>
                                    bis {formatDate(p.knownUntil)}
                                    {p.estimatedSoFar > Math.max(0.01 * p.consumptionSoFar, 0.5) && ` · davon ≈ ${formatConsumption(p.estimatedSoFar)} ${unit} geschätzt`}
                                    {kwh(p.consumptionSoFar)}
                                    {!meter.billingStart && " · Abrechnungsjahr = Kalenderjahr (in den Einstellungen änderbar)"}
                                </>
                            }
                        />
                        <Stat
                            label={`Prognose bis ${formatDate(p.periodEnd - 1)}`}
                            value={`${formatConsumption(p.projectedConsumption)} ${unit}`}
                            hint={
                                <>
                                    {BASIS_TEXT[p.basis]}
                                    {p.uncertain && " · grobe Schätzung"}
                                    {kwh(p.projectedConsumption)}
                                </>
                            }
                        />
                    </>
                )}
                {hasCost && p?.projectedCost != null && (
                    <Stat label="Kosten Abrechnungsjahr (geschätzt)" value={`≈ ${formatCurrency(p.projectedCost, { whole: true })}`} hint="inkl. Grundgebühr" />
                )}
            </dl>

            {!p && (
                <p className="text-xs text-muted-foreground">
                    Prognose und Kosten fürs Jahr erscheinen, sobald die Ablesungen mindestens {MIN_PROJECTION_DAYS} Tage auseinanderliegen.
                </p>
            )}

            {stats.months.length > 1 && (
                <section className="space-y-2" aria-labelledby={`chart-${meter.id}`}>
                    <h3 id={`chart-${meter.id}`}>
                        <FieldLabel>Verbrauch pro Monat</FieldLabel>
                    </h3>
                    <ConsumptionChart buckets={stats.months} unit={unit} colorClass={CHART_COLORS[meter.type]} until={stats.lastEnd!} />
                </section>
            )}
        </div>
    );
}

const REPLACEMENT_LABEL = "Zählerwechsel: neuer Zähler eingebaut";

function ReadingRow({
    reading,
    previous,
    meter,
    flag,
    edit,
    onEdit,
}: {
    reading: Reading;
    previous?: Reading;
    meter: MeterWithReadings;
    flag?: "ignored" | "drop";
    edit: EditRequest | null;
    onEdit: (edit: EditRequest | null) => void;
}) {
    const confirm = useConfirm();
    const { unit } = meter;
    const delta = previous && !reading.isReplacement ? reading.value - previous.value : null;
    const dateText = formatDate(reading.date);
    const editButton = useRef<HTMLButtonElement>(null);
    const editing = edit?.id === reading.id;
    const wasEditing = useRef(false);
    // Nach Speichern/Abbrechen den Fokus zurück auf die Zeile geben
    useEffect(() => {
        if (wasEditing.current && !editing) editButton.current?.focus();
        wasEditing.current = editing;
    }, [editing]);

    if (edit && editing) {
        return <ReadingEditor key={`${reading.id}:${edit.preset ?? ""}`} reading={reading} meter={meter} preset={edit.preset} onDone={() => onEdit(null)} />;
    }

    return (
        <li className="flex justify-between items-center p-3 hover:bg-accent/20 transition-colors group">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0" aria-hidden>
                    {reading.isReplacement ? <RefreshCw className="w-4 h-4 text-muted-foreground" /> : <History className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-black tabular-nums">
                        <span className={cn(flag === "ignored" && "line-through decoration-amber-600/70")}>
                            {formatReading(reading.value)} {unit}
                        </span>
                        {delta !== null && (
                            <span className={cn("ml-2 text-[11px] font-bold", delta < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
                                <span className="sr-only">, Verbrauch seit vorher: </span>
                                {formatDelta(delta)} {unit}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                        <span className="sr-only">, </span>
                        {dateText}
                        {reading.isReplacement && " · Zählerwechsel"}
                        {reading.source === "api" && " · automatisch"}
                        {flag === "ignored" && <span className="text-amber-800 dark:text-amber-300"> · Tippfehler? Zählt nicht mit</span>}
                        {flag === "drop" && <span className="text-amber-800 dark:text-amber-300"> · Stand gesunken – Zählerwechsel?</span>}
                    </div>
                </div>
            </div>
            <div className="flex">
                <button
                    ref={editButton}
                    type="button"
                    onClick={() => onEdit({ id: reading.id })}
                    className="hover-reveal w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-primary"
                    aria-label={`Ablesung vom ${dateText} bearbeiten`}
                >
                    <Pencil className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={async () => {
                        if (await confirm({ title: "Ablesung löschen?", message: `${formatReading(reading.value)} ${unit} vom ${dateText}`, confirmLabel: "Löschen", danger: true }))
                            await deleteReading(reading.id);
                    }}
                    className="hover-reveal w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                    aria-label={`Ablesung vom ${dateText} löschen`}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </li>
    );
}

/** Ablesung im Verlauf bearbeiten – mit derselben Vorschau und Prüfung wie beim Eintragen. */
function ReadingEditor({ reading, meter, preset, onDone }: { reading: Reading; meter: MeterWithReadings; preset?: "replacement"; onDone: () => void }) {
    const ref = useRef<HTMLLIElement>(null);
    const [value, setValue] = useState(() => toInputValue(reading.value));
    const [day, setDay] = useState(() => toDateInputValue(new Date(reading.date)));
    const [isReplacement, setIsReplacement] = useState(preset === "replacement" || reading.isReplacement);
    const [oldFinal, setOldFinal] = useState("");
    const [warning, setWarning] = useState<string | null>(null);
    const [error, setError] = useState("");
    const { unit } = meter;
    const others = useMemo(() => meter.readings.filter((r) => r.id !== reading.id), [meter.readings, reading.id]);
    // Gleicher Tag: Zeitpunkt unverändert. Anderer Tag: wie beim Eintragen (heute jetzt, sonst 12:00
    // bzw. die nächste freie Minute) – so kommen sich zwei Ablesungen nie in die Quere.
    const date = !day ? null : day === toDateInputValue(new Date(reading.date)) ? reading.date : timestampForDay(day, others);
    const addsOldFinal = isReplacement && !reading.isReplacement;

    useEffect(() => {
        ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }, []);

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        const parsed = parseDecimal(value);
        if (parsed === null || !date) {
            setError("Bitte einen gültigen Stand und ein Datum eingeben.");
            return;
        }
        const oldValue = addsOldFinal && oldFinal.trim() ? parseDecimal(oldFinal) : null;
        if (addsOldFinal && oldFinal.trim() && oldValue === null) {
            setError("Endstand bitte als Zahl eingeben – oder das Feld leer lassen.");
            return;
        }
        const changed = parsed !== reading.value || date !== reading.date || isReplacement !== reading.isReplacement;
        if (!changed) return onDone();
        const checked = !isReplacement
            ? { value: parsed, date, isReplacement: false }
            : oldValue !== null
              ? { value: oldValue, date, isReplacement: false }
              : { value: parsed, date, isReplacement: true };
        // Der Endstand gehört zum alten Zähler – spätere Stände (neuer Zähler) sind kein Maßstab
        const issue = checkReading(isReplacement ? readingsUntil(others, date) : others, checked, Date.now(), meter);
        if (issue?.kind === "future-date") {
            setError(plausibilityText(issue, unit));
            return;
        }
        const text = issue ? plausibilityText(issue, unit) : null;
        if (text && warning !== text) {
            setWarning(text); // zweites Tippen auf "Speichern" bestätigt
            return;
        }
        await updateReading(reading.id, { value: parsed, date, isReplacement });
        // Endstand des alten Zählers zum selben Zeitpunkt – die Sortierung stellt ihn vor den Wechsel
        if (oldValue !== null) await addReading(meter.id, { value: oldValue, date, isReplacement: false });
        onDone();
    };

    return (
        <li ref={ref} className="p-3 bg-accent/20">
            <form
                onSubmit={save}
                noValidate
                className="space-y-3"
                // Esc bricht nur das Bearbeiten ab, statt das ganze Sheet zu schließen
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.stopPropagation();
                        onDone();
                    }
                }}
            >
                {addsOldFinal && (
                    <div className="space-y-1">
                        <FieldLabel htmlFor={`edit-old-${reading.id}`}>Endstand alter Zähler (empfohlen)</FieldLabel>
                        <div className="relative">
                            <input
                                id={`edit-old-${reading.id}`}
                                autoFocus
                                inputMode="decimal"
                                value={oldFinal}
                                placeholder="Letzter Stand vor dem Ausbau"
                                onChange={(e) => {
                                    setOldFinal(e.target.value);
                                    setWarning(null);
                                }}
                                className="input-field w-full py-2 pr-12"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">{unit}</span>
                        </div>
                        {warning ? null : oldFinal.trim() ? (
                            <ReadingPreview meter={meter} readings={readingsUntil(others, date)} raw={oldFinal} date={date} />
                        ) : (
                            <p className="text-xs text-muted-foreground">{NO_FINAL_HINT}</p>
                        )}
                    </div>
                )}
                <div className="grid grid-cols-1 min-[360px]:grid-cols-[1fr_auto] gap-2">
                    <div className="space-y-1 min-w-0">
                        <FieldLabel htmlFor={`edit-value-${reading.id}`}>{isReplacement ? "Startstand neuer Zähler" : "Stand"}</FieldLabel>
                        <div className="relative">
                            <input
                                id={`edit-value-${reading.id}`}
                                autoFocus={!addsOldFinal}
                                inputMode="decimal"
                                value={value}
                                onChange={(e) => {
                                    setValue(e.target.value);
                                    setWarning(null);
                                }}
                                className="input-field w-full py-2 pr-12"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">{unit}</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <FieldLabel htmlFor={`edit-date-${reading.id}`}>Datum</FieldLabel>
                        <input
                            id={`edit-date-${reading.id}`}
                            type="date"
                            value={day}
                            max={toDateInputValue(new Date())}
                            onChange={(e) => {
                                setDay(e.target.value);
                                setWarning(null);
                            }}
                            className="input-field w-full py-2"
                        />
                    </div>
                </div>
                {!isReplacement && !warning && <ReadingPreview meter={meter} readings={others} raw={value} date={date} />}
                <label className="flex items-center gap-3 min-h-11 text-xs font-medium cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={isReplacement}
                        onChange={(e) => {
                            setIsReplacement(e.target.checked);
                            setWarning(null);
                        }}
                        className="w-5 h-5 shrink-0 accent-current"
                    />
                    {REPLACEMENT_LABEL}
                </label>
                {warning && <Alert variant="warning">{warning} Zum Speichern erneut tippen.</Alert>}
                {error && <Alert variant="error">{error}</Alert>}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onDone} className="btn btn-secondary min-h-11 text-xs">
                        Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary min-h-11 text-xs">
                        {warning ? "Trotzdem speichern" : "Speichern"}
                    </button>
                </div>
            </form>
        </li>
    );
}

function History_({ meter, edit, onEdit }: { meter: MeterWithReadings; edit: EditRequest | null; onEdit: (edit: EditRequest | null) => void }) {
    const [showAll, setShowAll] = useState(false);
    const { flags, previousOf } = useMemo(() => readingFlags(meter.readings), [meter.readings]);
    const desc = [...meter.readings].reverse();
    // Eine Ablesung, die bearbeitet werden soll (z. B. aus einem Hinweis), muss sichtbar sein
    const editIndex = edit ? desc.findIndex((r) => r.id === edit.id) : -1;
    const visible = showAll || editIndex >= 10 ? desc : desc.slice(0, 10);
    if (desc.length === 0) {
        return <p className="p-10 text-center text-xs text-muted-foreground italic border border-border rounded-2xl">Noch keine Ablesungen.</p>;
    }
    return (
        <div className="space-y-2">
            <ul className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                {visible.map((r) => (
                    <ReadingRow key={r.id} reading={r} previous={previousOf.get(r)} meter={meter} flag={flags.get(r)} edit={edit} onEdit={onEdit} />
                ))}
            </ul>
            <div className="flex justify-between gap-2">
                {desc.length > 10 ? (
                    <button
                        type="button"
                        onClick={() => setShowAll((v) => !v)}
                        className="min-h-11 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
                    >
                        {showAll ? "Weniger anzeigen" : `Alle ${desc.length} anzeigen`}
                    </button>
                ) : (
                    <span />
                )}
                <button
                    type="button"
                    onClick={() => shareOrDownloadCsv(readingsToCsv(meter.readings, meter.unit), meter)}
                    className="min-h-11 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1.5"
                >
                    <Download className="w-3.5 h-3.5" />
                    CSV exportieren
                </button>
            </div>
        </div>
    );
}

function Collapsible({ title, children, open, onToggle }: { title: string; children: ReactNode; open: boolean; onToggle: () => void }) {
    return (
        <section className="space-y-3">
            <h3>
                <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 w-full min-h-11 text-left">
                    <ChevronDown className={cn("w-4 h-4 opacity-50 transition-transform", !open && "-rotate-90")} aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
                </button>
            </h3>
            {open && children}
        </section>
    );
}

interface MeterDetailDialogProps {
    meter: MeterWithReadings | undefined;
    instance?: number;
    onClose: () => void;
    onAddReading: (meterId: string) => void;
}

interface DetailState {
    instance?: number;
    view: "overview" | "settings";
    historyOpen: boolean;
    form: MeterFormState | null;
    error: MeterFormError | null;
    edit: EditRequest | null;
}

const SETTINGS_PREFIX = "meter-settings";

export function MeterDetailDialog({ meter, instance, onClose, onAddReading }: MeterDetailDialogProps) {
    const confirm = useConfirm();
    const toast = useToast();
    const fresh = (): DetailState => ({ instance, view: "overview", historyOpen: true, form: null, error: null, edit: null });
    const [state, setState] = useState<DetailState>(fresh);
    // Bei jedem Öffnen frisch starten
    if (state.instance !== instance) setState(fresh());

    const Icon = meter ? METER_ICONS[meter.type].icon : null;
    const custom = meter ? customMeterName(meter) : null;
    const title = meter ? `${METER_TYPE_LABELS[meter.type]}zähler${custom ? ` · ${custom}` : ""}` : undefined;
    const dirty = !!meter && state.view === "settings" && !!state.form && JSON.stringify(state.form) !== JSON.stringify(meterFormFromFields(meter));

    const confirmDiscard = async () =>
        !dirty ||
        (await confirm({
            title: "Änderungen verwerfen?",
            message: "Deine Änderungen an den Einstellungen sind noch nicht gespeichert.",
            confirmLabel: "Verwerfen",
            danger: true,
        }));

    const requestClose = async () => {
        if (await confirmDiscard()) onClose();
    };

    const openSettings = () => {
        if (meter) setState((s) => ({ ...s, view: "settings", form: meterFormFromFields(meter), error: null, edit: null }));
    };
    const backToOverview = async () => {
        if (await confirmDiscard()) setState((s) => ({ ...s, view: "overview", form: null, error: null }));
    };

    const saveSettings = async () => {
        if (!meter || !state.form) return;
        const result = meterFieldsFromForm(state.form);
        if ("error" in result) {
            setState((s) => ({ ...s, error: result }));
            focusFormField(SETTINGS_PREFIX, result.field);
            return;
        }
        const n = meter.readings.length;
        const unitChanged = result.fields.unit !== meter.unit;
        const typeChanged = result.fields.type !== meter.type;
        if (n > 0 && (unitChanged || typeChanged)) {
            const what = [typeChanged && `als ${METER_TYPE_LABELS[result.fields.type]}`, unitChanged && `in ${result.fields.unit}`].filter(Boolean).join(" ");
            const ok = await confirm({
                title: typeChanged && unitChanged ? "Zählertyp und Einheit ändern?" : unitChanged ? "Einheit ändern?" : "Zählertyp ändern?",
                message: `${n === 1 ? "Die Ablesung bleibt" : `Die ${n} Ablesungen bleiben`} unverändert und ${n === 1 ? "gilt" : "gelten"} danach ${what}. Nur ändern, wenn das beim Anlegen falsch eingestellt war.`,
                confirmLabel: "Ändern",
            });
            if (!ok) return;
        }
        await updateMeter(meter.id, result.fields);
        toast({ message: "Einstellungen gespeichert", variant: "success" });
        setState((s) => ({ ...s, view: "overview", form: null, error: null }));
    };

    const removeMeter = async () => {
        if (!meter) return;
        const n = meter.readings.length;
        const ok = await confirm({
            title: `${meterTitle(meter)} löschen?`,
            message: `Der Zähler${n ? ` und ${n === 1 ? "seine Ablesung" : `seine ${n} Ablesungen`}` : ""} ${n ? "werden" : "wird"} gelöscht – auch für die anderen im Haushalt. Das lässt sich nicht rückgängig machen.`,
            confirmLabel: "Endgültig löschen",
            danger: true,
        });
        if (ok) {
            onClose();
            await deleteMeter(meter.id);
        }
    };

    const settings = state.view === "settings";
    const setForm = (form: MeterFormState) => setState((s) => ({ ...s, form }));

    return (
        <BaseDialog
            isOpen={!!meter}
            onClose={() => void requestClose()}
            title={settings ? "Einstellungen" : title}
            className="sm:max-w-2xl"
            headerAction={
                meter &&
                (settings ? (
                    <button type="button" onClick={() => void backToOverview()} className="w-11 h-11 flex items-center justify-center hover:bg-accent rounded-full" aria-label="Zurück zur Übersicht">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                ) : (
                    <button type="button" onClick={openSettings} className="w-11 h-11 flex items-center justify-center hover:bg-accent rounded-full" aria-label="Einstellungen & Kosten">
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                ))
            }
            footer={
                meter &&
                (settings ? (
                    <div className="space-y-3">
                        {state.error && <Alert variant="error">{state.error.error}</Alert>}
                        <button type="button" onClick={() => void saveSettings()} className="w-full btn btn-primary min-h-12">
                            Einstellungen speichern
                        </button>
                    </div>
                ) : (
                    <button type="button" onClick={() => onAddReading(meter.id)} className="w-full btn btn-primary min-h-12">
                        {Icon && <Icon className="w-4 h-4" />}
                        Ablesung eintragen
                    </button>
                ))
            }
        >
            {meter && settings && state.form && (
                <div className="space-y-6">
                    <MeterTypeFields form={state.form} onChange={setForm} idPrefix={SETTINGS_PREFIX} invalid={state.error?.field} />
                    <div className="border-t border-border/50 pt-4">
                        <MeterCostFields form={state.form} onChange={setForm} idPrefix={SETTINGS_PREFIX} invalid={state.error?.field} />
                    </div>
                    <div className="border-t border-border/50 pt-4">
                        <button type="button" onClick={() => void removeMeter()} className="min-h-11 flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400 hover:underline">
                            <Trash2 className="w-4 h-4" />
                            Zähler löschen
                        </button>
                    </div>
                </div>
            )}
            {meter && !settings && (
                <div key={`${meter.id}:${instance}`} className="space-y-8">
                    <Statistics meter={meter} onOpenSettings={openSettings} onFix={(edit) => setState((s) => ({ ...s, edit, historyOpen: true }))} />
                    <Collapsible title={`Verlauf (${meter.readings.length})`} open={state.historyOpen} onToggle={() => setState((s) => ({ ...s, historyOpen: !s.historyOpen }))}>
                        <History_ meter={meter} edit={state.edit} onEdit={(edit) => setState((s) => ({ ...s, edit }))} />
                    </Collapsible>
                </div>
            )}
        </BaseDialog>
    );
}
