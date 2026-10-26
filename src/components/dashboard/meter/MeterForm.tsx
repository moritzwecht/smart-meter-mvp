"use client";

import { FieldLabel } from "@/components/ui/AddTile";
import { DEFAULT_UNIT, METER_TYPE_LABELS, METER_UNITS } from "@/lib/meter/format";
import { parseOptionalDecimal, toInputValue } from "@/lib/numbers";
import type { MeterFields, MeterType } from "@/lib/sync/types";
import { cn } from "@/lib/utils";
import { METER_ICONS } from "./MeterWidget";

/*
 * Formular für Zählertyp, Einheit und Kosten – geteilt von "Neuer Zähler" und den
 * Zählereinstellungen. Werte werden als Text bearbeitet (deutsches Komma erlaubt)
 * und erst beim Speichern geprüft und in Zahlen umgewandelt.
 */

export interface MeterFormState {
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

export const emptyMeterForm = (type: MeterType = "ELECTRICITY"): MeterFormState =>
    meterFormFromFields({ type, unit: DEFAULT_UNIT[type] });

const NUMBER_FIELDS = {
    monthlyPayment: "Abschlag",
    basicFee: "Grundgebühr",
    pricePerUnit: "Verbrauchspreis",
    zNumber: "Zustandszahl",
    calorificValue: "Brennwert",
} as const;

/** Prüft das Formular. Liefert die Felder oder eine Fehlermeldung. */
export function meterFieldsFromForm(form: MeterFormState): { fields: Omit<MeterFields, "isPinned"> } | { error: string } {
    const unit = form.unit.trim();
    if (!unit) return { error: "Bitte gib eine Einheit an." };
    const numbers: Record<string, number | null> = {};
    for (const [key, label] of Object.entries(NUMBER_FIELDS)) {
        const value = parseOptionalDecimal(form[key as keyof typeof NUMBER_FIELDS]);
        if (value === undefined) return { error: `${label}: bitte eine Zahl eingeben (z. B. 12,50).` };
        if (value !== null && value < 0) return { error: `${label} darf nicht negativ sein.` };
        numbers[key] = value;
    }
    const conversion = form.type === "GAS" && unit === "m³" && form.priceUnit === "kwh";
    return {
        fields: {
            type: form.type,
            unit,
            monthlyPayment: numbers.monthlyPayment,
            basicFee: numbers.basicFee,
            pricePerUnit: numbers.pricePerUnit,
            priceUnit: form.type === "GAS" ? form.priceUnit : null,
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
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    suffix: string;
    placeholder: string;
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
                    className="input-field w-full pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold pointer-events-none">
                    {suffix}
                </span>
            </div>
        </div>
    );
}

export function MeterTypeFields({ form, onChange }: { form: MeterFormState; onChange: (form: MeterFormState) => void }) {
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
                                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                                form.unit === u ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-accent/50 hover:bg-accent text-muted-foreground",
                            )}
                        >
                            {u}
                        </button>
                    ))}
                    <input
                        type="text"
                        aria-label="Andere Einheit"
                        placeholder="Andere…"
                        maxLength={16}
                        value={customUnit ? form.unit : ""}
                        onChange={(e) => onChange({ ...form, unit: e.target.value })}
                        className={cn("flex-1 min-w-[100px] input-field font-bold py-2", customUnit && form.unit && "border-primary/50")}
                    />
                </div>
            </div>
        </div>
    );
}

export function MeterCostFields({ form, onChange, idPrefix }: { form: MeterFormState; onChange: (form: MeterFormState) => void; idPrefix: string }) {
    const set = (key: keyof MeterFormState) => (value: string) => onChange({ ...form, [key]: value });
    const priceInKwh = form.type === "GAS" && form.priceUnit === "kwh";
    const showConversion = form.type === "GAS" && form.unit === "m³" && priceInKwh;
    const priceSuffix = `€/${priceInKwh ? "kWh" : form.unit || "Einheit"}`;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MoneyInput id={`${idPrefix}-payment`} label="Abschlag pro Monat" value={form.monthlyPayment} onChange={set("monthlyPayment")} suffix="€" placeholder="0,00" />
                <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                        <FieldLabel htmlFor={`${idPrefix}-price`}>Verbrauchspreis</FieldLabel>
                        {form.type === "GAS" && (
                            <div className="flex gap-1" role="radiogroup" aria-label="Preiseinheit">
                                {[
                                    { value: null, label: `€/${form.unit || "m³"}` },
                                    { value: "kwh", label: "€/kWh" },
                                ].map((o) => (
                                    <button
                                        key={o.label}
                                        type="button"
                                        role="radio"
                                        aria-checked={(form.priceUnit ?? null) === o.value}
                                        onClick={() => onChange({ ...form, priceUnit: o.value })}
                                        className={cn(
                                            "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                            (form.priceUnit ?? null) === o.value ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground",
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
                            placeholder="0,000"
                            className="input-field w-full pr-20"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold pointer-events-none">{priceSuffix}</span>
                    </div>
                </div>
                <MoneyInput id={`${idPrefix}-fee`} label="Grundgebühr pro Monat" value={form.basicFee} onChange={set("basicFee")} suffix="€" placeholder="0,00" />
                <div className="space-y-2">
                    <FieldLabel htmlFor={`${idPrefix}-billing`}>Beginn Abrechnungsjahr</FieldLabel>
                    <input
                        id={`${idPrefix}-billing`}
                        type="date"
                        value={form.billingStart}
                        onChange={(e) => set("billingStart")(e.target.value)}
                        className="input-field w-full"
                    />
                </div>
            </div>

            {showConversion && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-full p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-600 dark:text-blue-400">
                        <p className="font-bold mb-1">Umrechnung m³ → kWh</p>
                        Dein Zähler misst in m³, der Preis gilt pro kWh. Zustandszahl und Brennwert stehen auf deiner Gasrechnung.
                    </div>
                    <MoneyInput id={`${idPrefix}-z`} label="Zustandszahl" value={form.zNumber} onChange={set("zNumber")} suffix="" placeholder="z. B. 0,95" />
                    <MoneyInput id={`${idPrefix}-cv`} label="Brennwert" value={form.calorificValue} onChange={set("calorificValue")} suffix="kWh/m³" placeholder="z. B. 11,2" />
                </div>
            )}
        </div>
    );
}
