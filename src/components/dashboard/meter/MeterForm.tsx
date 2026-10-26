"use client";

import { FieldLabel } from "@/components/ui/AddTile";
import { DEFAULT_UNIT, METER_TYPE_LABELS, METER_UNITS } from "@/lib/meter/format";
import { customMeterName, MAX_METER_NAME } from "@/lib/meter/names";
import { isCubicMeters, priceLooksTooHigh } from "@/lib/meter/stats";
import { formatNumber, parseDecimal, parseOptionalDecimal, toInputValue } from "@/lib/numbers";
import type { MeterFields, MeterType } from "@/lib/sync/types";
import { cn } from "@/lib/utils";
import { METER_ICONS } from "./MeterWidget";

/*
 * Formular für Name, Zählertyp, Einheit und Kosten – geteilt von "Neuer Zähler" und
 * den Zählereinstellungen. Werte werden als Text bearbeitet (deutsches Komma erlaubt)
 * und erst beim Speichern geprüft und in Zahlen umgewandelt.
 */

export interface MeterFormState {
    name: string;
    type: MeterType;
    unit: string;
    monthlyPayment: string;
    basicFee: string;
    pricePerUnit: string;
    priceUnit: string | null;
    zNumber: string;
    calorificValue: string;
    billingStart: string;
}

export function meterFormFromFields(fields: Partial<MeterFields> & { type: MeterType; unit: string }): MeterFormState {
    return {
        name: customMeterName(fields) ?? "",
        type: fields.type,
        unit: fields.unit,
        monthlyPayment: toInputValue(fields.monthlyPayment),
        basicFee: toInputValue(fields.basicFee),
        pricePerUnit: toInputValue(fields.pricePerUnit),
        priceUnit: fields.priceUnit === "kwh" ? "kwh" : null,
        zNumber: toInputValue(fields.zNumber),
        calorificValue: toInputValue(fields.calorificValue),
        billingStart: fields.billingStart ?? "",
    };
}

/** Gastarife werden praktisch immer in ct/kWh angegeben – daher für Gas „€/kWh“ voreingestellt. */
export const emptyMeterForm = (type: MeterType = "ELECTRICITY"): MeterFormState => ({
    ...meterFormFromFields({ type, unit: DEFAULT_UNIT[type] }),
    priceUnit: type === "GAS" ? "kwh" : null,
});

/** "m3" → "m³", sonst unverändert (ohne Leerzeichen am Rand). */
const normalizeUnit = (unit: string) => (isCubicMeters(unit) ? "m³" : unit.trim());

/** Der Schalter €/m³ ↔ €/kWh ergibt nur bei Gas in m³ Sinn. */
const hasPriceUnitChoice = (form: Pick<MeterFormState, "type" | "unit">) => form.type === "GAS" && isCubicMeters(form.unit);

const NUMBER_FIELDS = {
    monthlyPayment: "Abschlag",
    basicFee: "Grundgebühr",
    pricePerUnit: "Arbeitspreis",
    zNumber: "Zustandszahl",
    calorificValue: "Brennwert",
} as const;

/** Feld → Element-ID (mit Präfix), damit bei einem Fehler das Feld den Fokus bekommt */
const FIELD_IDS: Partial<Record<keyof MeterFormState, string>> = {
    unit: "unit",
    monthlyPayment: "payment",
    basicFee: "fee",
    pricePerUnit: "price",
    zNumber: "z",
    calorificValue: "cv",
};

export type MeterFormError = { error: string; field?: keyof MeterFormState };

/** Setzt den Fokus auf das fehlerhafte Feld (und scrollt es in den sichtbaren Bereich). */
export function focusFormField(idPrefix: string, field: keyof MeterFormState | undefined) {
    const suffix = field && FIELD_IDS[field];
    if (!suffix) return;
    // nach dem nächsten Rendern – das Feld kann gerade erst aufgeklappt worden sein
    requestAnimationFrame(() => {
        const el = document.getElementById(`${idPrefix}-${suffix}`);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        el?.focus({ preventScroll: true });
    });
}

/** Prüft das Formular. Liefert die Felder oder eine Fehlermeldung (mit dem betroffenen Feld). */
export function meterFieldsFromForm(form: MeterFormState): { fields: Omit<MeterFields, "isPinned"> } | MeterFormError {
    const unit = normalizeUnit(form.unit);
    if (!unit) return { error: "Bitte gib eine Einheit an.", field: "unit" };
    const numbers: Record<string, number | null> = {};
    for (const [key, label] of Object.entries(NUMBER_FIELDS)) {
        const field = key as keyof typeof NUMBER_FIELDS;
        const value = parseOptionalDecimal(form[field]);
        if (value === undefined) return { error: `${label}: bitte eine Zahl eingeben (z. B. 12,50).`, field };
        if (value !== null && value < 0) return { error: `${label} darf nicht negativ sein.`, field };
        numbers[key] = value;
    }
    const priceUnit = hasPriceUnitChoice({ type: form.type, unit }) && form.priceUnit === "kwh" ? "kwh" : null;
    const conversion = priceUnit === "kwh";
    // Fehlende Zustandszahl/Brennwert sind erlaubt – die App zeigt dann keine Kosten (siehe canComputeCost).
    // Eingetragene Werte müssen aber plausibel sein, sonst wären die Kosten falsch.
    if (conversion && numbers.zNumber !== null && (numbers.zNumber < 0.5 || numbers.zNumber > 1.5))
        return { error: "Zustandszahl: Sie liegt meist zwischen 0,8 und 1 (z. B. 0,95).", field: "zNumber" };
    if (conversion && numbers.calorificValue !== null && (numbers.calorificValue < 5 || numbers.calorificValue > 15))
        return { error: "Brennwert: Er liegt meist zwischen 9 und 13 kWh/m³ (z. B. 11,2).", field: "calorificValue" };
    return {
        fields: {
            name: form.name.trim().slice(0, MAX_METER_NAME),
            type: form.type,
            unit,
            monthlyPayment: numbers.monthlyPayment,
            basicFee: numbers.basicFee,
            pricePerUnit: numbers.pricePerUnit,
            priceUnit,
            zNumber: conversion ? numbers.zNumber : null,
            calorificValue: conversion ? numbers.calorificValue : null,
            billingStart: form.billingStart || null,
        },
    };
}

function MoneyInput({
    id,
    label,
    value,
    onChange,
    suffix,
    placeholder,
    hint,
    invalid,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    suffix: string;
    placeholder: string;
    hint?: string;
    invalid?: boolean;
}) {
    return (
        <div className="space-y-2">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-invalid={invalid || undefined}
                    aria-describedby={hint ? `${id}-hint` : undefined}
                    className={cn("input-field w-full pr-16", invalid && "border-red-600 dark:border-red-400")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold pointer-events-none">
                    {suffix}
                </span>
            </div>
            {hint && (
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
        </div>
    );
}

export function MeterTypeFields({
    form,
    onChange,
    idPrefix,
    invalid,
}: {
    form: MeterFormState;
    onChange: (form: MeterFormState) => void;
    idPrefix: string;
    invalid?: keyof MeterFormState;
}) {
    const customUnit = !METER_UNITS.includes(form.unit);
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <FieldLabel>Typ</FieldLabel>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Zählertyp">
                    {(Object.keys(METER_TYPE_LABELS) as MeterType[]).map((type) => {
                        const cfg = METER_ICONS[type];
                        const selected = form.type === type;
                        return (
                            <button
                                key={type}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() =>
                                    onChange({
                                        ...form,
                                        type,
                                        // Einheit mitziehen, solange keine eigene gewählt wurde
                                        unit: METER_UNITS.includes(form.unit) ? DEFAULT_UNIT[type] : form.unit,
                                        // Gas: €/kWh voreinstellen, solange noch kein Preis eingetragen ist
                                        priceUnit: type === "GAS" && !form.pricePerUnit.trim() ? "kwh" : form.priceUnit,
                                    })
                                }
                                className={cn(
                                    "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all",
                                    selected ? "border-primary bg-primary/5" : "border-transparent bg-accent/30 hover:bg-accent/50",
                                )}
                            >
                                <cfg.icon className={cn("w-6 h-6", cfg.color)} />
                                <span className="text-[10px] font-bold uppercase">{METER_TYPE_LABELS[type]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <FieldLabel>Einheit</FieldLabel>
                <div className="flex flex-wrap gap-2">
                    {METER_UNITS.map((u) => (
                        <button
                            key={u}
                            type="button"
                            aria-pressed={form.unit === u}
                            onClick={() => onChange({ ...form, unit: u })}
                            className={cn(
                                "px-4 min-h-11 min-w-11 rounded-xl text-sm font-bold transition-all",
                                form.unit === u ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-accent/50 hover:bg-accent text-foreground/70",
                            )}
                        >
                            {u}
                        </button>
                    ))}
                    <input
                        id={`${idPrefix}-unit`}
                        type="text"
                        aria-label="Andere Einheit"
                        placeholder="Andere…"
                        maxLength={16}
                        value={customUnit ? form.unit : ""}
                        aria-invalid={invalid === "unit" || undefined}
                        onChange={(e) => onChange({ ...form, unit: e.target.value })}
                        className={cn("flex-1 min-w-[100px] input-field font-bold py-2", customUnit && form.unit && "border-primary/50", invalid === "unit" && "border-red-600")}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <FieldLabel htmlFor={`${idPrefix}-name`}>Name (optional)</FieldLabel>
                <input
                    id={`${idPrefix}-name`}
                    type="text"
                    value={form.name}
                    maxLength={MAX_METER_NAME}
                    onChange={(e) => onChange({ ...form, name: e.target.value })}
                    placeholder="z. B. Wärmepumpe, Garten"
                    aria-describedby={`${idPrefix}-name-hint`}
                    className="input-field w-full"
                />
                <p id={`${idPrefix}-name-hint`} className="text-xs text-muted-foreground">
                    Hilft, mehrere Zähler gleicher Art auseinanderzuhalten.
                </p>
            </div>
        </div>
    );
}

/** Beispielpreis passend zur Einheit – als Platzhalter, damit er nicht wie ein eingetragener Wert aussieht. */
function pricePlaceholder(form: MeterFormState, perKwh: boolean) {
    if (perKwh || form.unit.trim().toLowerCase() === "kwh") return "z. B. 0,32";
    if (isCubicMeters(form.unit)) return form.type === "WATER" ? "z. B. 4,50" : "z. B. 1,20";
    if (form.unit.trim() === "l") return "z. B. 0,0045";
    return "";
}

export function MeterCostFields({
    form,
    onChange,
    idPrefix,
    invalid,
}: {
    form: MeterFormState;
    onChange: (form: MeterFormState) => void;
    idPrefix: string;
    invalid?: keyof MeterFormState;
}) {
    const set = (key: keyof MeterFormState) => (value: string) => onChange({ ...form, [key]: value });
    const choice = hasPriceUnitChoice(form);
    const showConversion = choice && form.priceUnit === "kwh";
    const priceSuffix = `€/${showConversion ? "kWh" : form.unit.trim() || "Einheit"}`;
    const price = parseDecimal(form.pricePerUnit);
    // Ein Gaspreis pro m³ liegt bei rund 1 €; unter 0,40 € ist es vermutlich ein Preis pro kWh
    const looksLikeKwhPrice = choice && !showConversion && price !== null && price > 0 && price < 0.4;
    // Cent statt Euro eingetippt? (z. B. „32“ statt „0,32“)
    const tooHigh = priceLooksTooHigh({ type: form.type, unit: form.unit, priceUnit: showConversion ? "kwh" : null, pricePerUnit: price });
    const conversionIncomplete = showConversion && price !== null && price > 0 && (!form.zNumber.trim() || !form.calorificValue.trim());

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MoneyInput
                    id={`${idPrefix}-payment`}
                    label="Abschlag pro Monat"
                    value={form.monthlyPayment}
                    onChange={set("monthlyPayment")}
                    suffix="€"
                    placeholder="z. B. 120"
                    hint="Bei 11 Abschlägen im Jahr: Jahresbetrag ÷ 12."
                    invalid={invalid === "monthlyPayment"}
                />
                <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                        <FieldLabel htmlFor={`${idPrefix}-price`}>Arbeitspreis</FieldLabel>
                        {choice && (
                            <div className="flex gap-1 -my-2" role="radiogroup" aria-label="Preiseinheit">
                                {[
                                    { value: null, label: "€/m³" },
                                    { value: "kwh", label: "€/kWh" },
                                ].map((o) => (
                                    <button
                                        key={o.value ?? "unit"}
                                        type="button"
                                        role="radio"
                                        aria-checked={(form.priceUnit ?? null) === o.value}
                                        onClick={() => onChange({ ...form, priceUnit: o.value })}
                                        className={cn(
                                            "text-[11px] font-bold px-3 min-h-11 rounded-lg",
                                            (form.priceUnit ?? null) === o.value ? "bg-primary text-primary-foreground" : "bg-accent text-foreground/70",
                                        )}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            id={`${idPrefix}-price`}
                            type="text"
                            inputMode="decimal"
                            value={form.pricePerUnit}
                            onChange={(e) => set("pricePerUnit")(e.target.value)}
                            placeholder={pricePlaceholder(form, showConversion)}
                            aria-invalid={invalid === "pricePerUnit" || undefined}
                            aria-describedby={`${idPrefix}-price-hint`}
                            className={cn("input-field w-full pr-20", invalid === "pricePerUnit" && "border-red-600 dark:border-red-400")}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold pointer-events-none">{priceSuffix}</span>
                    </div>
                    <div id={`${idPrefix}-price-hint`} className="space-y-2">
                        <p className="text-xs text-muted-foreground">In Euro, brutto – wie auf deiner Rechnung.</p>
                        {tooHigh && price !== null && (
                            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1" role="status">
                                <p>
                                    {formatNumber(price, 4, 2)} {priceSuffix} ist sehr hoch.{" "}
                                    {tooHigh === 1000 ? "Ist das der Preis pro m³? Pro Liter ist es ein Tausendstel." : "Steht auf der Rechnung ein Preis in Cent?"}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => set("pricePerUnit")(toInputValue(Number((price / tooHigh).toPrecision(6))))}
                                    className="min-h-11 px-3 rounded-lg bg-amber-500/15 font-bold text-amber-900 dark:text-amber-200"
                                >
                                    Auf {formatNumber(price / tooHigh, 6, 2)} € ändern
                                </button>
                            </div>
                        )}
                        {looksLikeKwhPrice && (
                            <p className="text-xs text-amber-800 dark:text-amber-300">
                                Gaspreise stehen meist pro kWh auf der Rechnung (z. B. 0,11 €/kWh). Gilt dein Preis pro kWh, stell oben auf „€/kWh“ um.
                            </p>
                        )}
                    </div>
                </div>
                <MoneyInput
                    id={`${idPrefix}-fee`}
                    label="Grundgebühr pro Monat"
                    value={form.basicFee}
                    onChange={set("basicFee")}
                    suffix="€"
                    placeholder="z. B. 12,50"
                    invalid={invalid === "basicFee"}
                />
                <div className="space-y-2">
                    <FieldLabel htmlFor={`${idPrefix}-billing`}>Beginn Abrechnungsjahr</FieldLabel>
                    <input
                        id={`${idPrefix}-billing`}
                        type="date"
                        value={form.billingStart}
                        onChange={(e) => set("billingStart")(e.target.value)}
                        aria-describedby={`${idPrefix}-billing-hint`}
                        className="input-field w-full"
                    />
                    <p id={`${idPrefix}-billing-hint`} className="text-xs text-muted-foreground">
                        Steht auf deiner letzten Jahresabrechnung. Leer = 1. Januar.
                    </p>
                </div>
            </div>

            {showConversion && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-full p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                        <p className="font-bold mb-1">Umrechnung m³ → kWh</p>
                        Dein Zähler misst in m³, der Preis gilt pro kWh. Zustandszahl und Brennwert stehen auf deiner Gasrechnung.
                        {conversionIncomplete && " Ohne sie zeigt die App noch keine Kosten – du kannst sie auch später ergänzen."}
                    </div>
                    <MoneyInput
                        id={`${idPrefix}-z`}
                        label="Zustandszahl"
                        value={form.zNumber}
                        onChange={set("zNumber")}
                        suffix=""
                        placeholder="z. B. 0,95"
                        invalid={invalid === "zNumber"}
                    />
                    <MoneyInput
                        id={`${idPrefix}-cv`}
                        label="Brennwert"
                        value={form.calorificValue}
                        onChange={set("calorificValue")}
                        suffix="kWh/m³"
                        placeholder="z. B. 11,2"
                        invalid={invalid === "calorificValue"}
                    />
                </div>
            )}
        </div>
    );
}
