"use client";

import { Check, ChevronDown, Download, History, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FieldLabel } from "@/components/ui/AddTile";
import { Alert } from "@/components/ui/Alert";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatConsumption, formatDate, formatReading, METER_TYPE_LABELS, toDateInputValue } from "@/lib/meter/format";
import {
    canComputeCost,
    consumptionCost,
    dailyAverage,
    monthlyConsumption,
    projectBillingPeriod,
    recentDailyAverage,
    toSegments,
} from "@/lib/meter/stats";
import { readingsToCsv, shareOrDownloadCsv } from "@/lib/meter/export";
import { formatCurrency, parseDecimal, toInputValue } from "@/lib/numbers";
import type { MeterWithReadings } from "@/lib/offline/hooks";
import { deleteMeter, deleteReading, updateMeter, updateReading } from "@/lib/offline/repo";
import type { Reading } from "@/lib/sync/types";
import { cn } from "@/lib/utils";
import { ConsumptionChart } from "./ConsumptionChart";
import { MeterCostFields, meterFieldsFromForm, meterFormFromFields, MeterTypeFields } from "./MeterForm";
import { METER_ICONS } from "./MeterWidget";

const CHART_COLORS = { ELECTRICITY: "bg-amber-500", WATER: "bg-blue-500", GAS: "bg-orange-500" } as const;

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
    return (
        <div className="p-3 bg-accent/30 rounded-2xl space-y-1 border-2 border-border/50 min-w-0">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">{label}</div>
            <div
                className={cn(
                    "text-xl font-black tabular-nums truncate",
                    tone === "good" && "text-emerald-600 dark:text-emerald-400",
                    tone === "bad" && "text-red-600 dark:text-red-400",
                )}
            >
                {value}
            </div>
            {hint && <div className="text-[10px] text-muted-foreground leading-snug">{hint}</div>}
        </div>
    );
}

function Statistics({ meter }: { meter: MeterWithReadings }) {
    const stats = useMemo(() => {
        const { segments, anomalies } = toSegments(meter.readings);
        return {
            segments,
            anomalies,
            overall: dailyAverage(segments),
            recent: recentDailyAverage(segments, 30),
            months: monthlyConsumption(segments, 12),
            projection: projectBillingPeriod(meter, segments),
        };
    }, [meter]);

    if (stats.overall === null) {
        return (
            <div className="p-8 text-center bg-accent/20 rounded-2xl border border-dashed border-border text-xs text-muted-foreground">
                Ab zwei Ablesungen siehst du hier Verbrauch, Verlauf und eine Prognose.
            </div>
        );
    }

    const p = stats.projection;
    const hasCost = canComputeCost(meter);
    const perDayCost = hasCost && stats.recent !== null ? consumptionCost(meter, stats.recent) : null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
                <Stat
                    label="Ø pro Tag (30 Tage)"
                    value={stats.recent !== null ? `${formatConsumption(stats.recent)} ${meter.unit}` : "–"}
                    hint={perDayCost !== null ? `≈ ${formatCurrency(perDayCost * 30.44)} pro Monat` : undefined}
                />
                <Stat label="Ø pro Tag (gesamt)" value={`${formatConsumption(stats.overall)} ${meter.unit}`} />
                {p && (
                    <>
                        <Stat
                            label="Abrechnungsjahr bisher"
                            value={`${formatConsumption(p.consumptionSoFar)} ${meter.unit}`}
                            hint={`seit ${formatDate(p.periodStart)}`}
                        />
                        <Stat
                            label="Prognose Jahr"
                            value={`${formatConsumption(p.projectedConsumption)} ${meter.unit}`}
                            hint={p.basis === "last-year" ? "Rest anhand des Vorjahres" : "Rest anhand des Durchschnitts"}
                        />
                    </>
                )}
                {p?.projectedCost != null && (
                    <Stat label="Kosten (Prognose)" value={formatCurrency(p.projectedCost)} hint="inkl. Grundgebühr" />
                )}
                {p?.balance != null && (
                    <Stat
                        label={p.balance >= 0 ? "Voraussichtl. Guthaben" : "Voraussichtl. Nachzahlung"}
                        value={formatCurrency(Math.abs(p.balance))}
                        hint={`bei ${formatCurrency(p.payments! / 12)} Abschlag`}
                        tone={p.balance >= 0 ? "good" : "bad"}
                    />
                )}
            </div>

            {stats.months.length > 1 && (
                <div className="space-y-2">
                    <FieldLabel>Verbrauch pro Monat</FieldLabel>
                    <ConsumptionChart buckets={stats.months} unit={meter.unit} colorClass={CHART_COLORS[meter.type]} />
                </div>
            )}

            {stats.anomalies > 0 && (
                <Alert variant="warning">
                    {stats.anomalies === 1 ? "Eine Ablesung ist" : `${stats.anomalies} Ablesungen sind`} niedriger als die vorherige und
                    {stats.anomalies === 1 ? " wird" : " werden"} nicht mitgerechnet. Tippfehler korrigieren oder als Zählerwechsel markieren.
                </Alert>
            )}
        </div>
    );
}

function ReadingRow({ reading, previous, unit }: { reading: Reading; previous?: Reading; unit: string }) {
    const confirm = useConfirm();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");
    const [day, setDay] = useState("");
    const [error, setError] = useState("");
    const delta = previous && !reading.isReplacement ? reading.value - previous.value : null;

    const startEdit = () => {
        setValue(toInputValue(reading.value));
        setDay(toDateInputValue(new Date(reading.date)));
        setError("");
        setEditing(true);
    };

    const save = async () => {
        const parsed = parseDecimal(value);
        if (parsed === null || !day) {
            setError("Ungültiger Wert");
            return;
        }
        const original = new Date(reading.date);
        const [y, m, d] = day.split("-").map(Number);
        const date = new Date(y, m - 1, d, original.getHours(), original.getMinutes()).toISOString();
        await updateReading(reading.id, { value: parsed, date });
        setEditing(false);
    };

    if (editing) {
        return (
            <div className="p-3 space-y-2 bg-accent/20">
                <div className="flex gap-2">
                    <input
                        autoFocus
                        aria-label="Zählerstand"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="input-field flex-1 min-w-0 py-2"
                    />
                    <input aria-label="Datum" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input-field py-2" />
                </div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-red-500">{error}</span>
                    <div className="flex gap-1">
                        <button type="button" onClick={() => setEditing(false)} className="p-2 rounded-lg hover:bg-accent" aria-label="Abbrechen">
                            <X className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={save} className="p-2 rounded-lg bg-primary text-primary-foreground" aria-label="Speichern">
                            <Check className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-between items-center p-3 hover:bg-accent/20 transition-colors group">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                    {reading.isReplacement ? <RefreshCw className="w-4 h-4 text-muted-foreground" /> : <History className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-black tabular-nums">
                        {formatReading(reading.value)} {unit}
                        {delta !== null && (
                            <span className={cn("ml-2 text-[10px] font-bold", delta < 0 ? "text-red-500" : "text-muted-foreground")}>
                                {delta >= 0 ? "+" : ""}
                                {formatConsumption(delta)}
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                        {formatDate(reading.date)}
                        {reading.isReplacement && " · Zählerwechsel"}
                        {reading.source === "api" && " · automatisch"}
                    </div>
                </div>
            </div>
            <div className="flex">
                <button type="button" onClick={startEdit} className="hover-reveal w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-primary" aria-label="Ablesung bearbeiten">
                    <Pencil className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={async () => {
                        if (await confirm({ title: "Ablesung löschen?", message: `${formatReading(reading.value)} ${unit} vom ${formatDate(reading.date)}`, confirmLabel: "Löschen", danger: true }))
                            await deleteReading(reading.id);
                    }}
                    className="hover-reveal w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-red-500"
                    aria-label="Ablesung löschen"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function History_({ meter }: { meter: MeterWithReadings }) {
    const [showAll, setShowAll] = useState(false);
    const desc = [...meter.readings].reverse();
    const visible = showAll ? desc : desc.slice(0, 10);
    if (desc.length === 0) {
        return <div className="p-10 text-center text-xs text-muted-foreground italic border border-border rounded-2xl">Noch keine Ablesungen.</div>;
    }
    return (
        <div className="space-y-2">
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                {visible.map((r, i) => (
                    <ReadingRow key={r.id} reading={r} previous={desc[i + 1]} unit={meter.unit} />
                ))}
            </div>
            <div className="flex justify-between gap-2">
                {desc.length > 10 ? (
                    <button type="button" onClick={() => setShowAll((v) => !v)} className="py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
                        {showAll ? "Weniger anzeigen" : `Alle ${desc.length} anzeigen`}
                    </button>
                ) : (
                    <span />
                )}
                <button
                    type="button"
                    onClick={() => shareOrDownloadCsv(readingsToCsv(meter.readings, meter.unit), meter.type)}
                    className="py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1.5"
                >
                    <Download className="w-3.5 h-3.5" />
                    CSV exportieren
                </button>
            </div>
        </div>
    );
}

function Settings({ meter }: { meter: MeterWithReadings }) {
    const toast = useToast();
    const [form, setForm] = useState(() => meterFormFromFields(meter));
    const [error, setError] = useState("");

    const save = async () => {
        const result = meterFieldsFromForm(form);
        if ("error" in result) {
            setError(result.error);
            return;
        }
        setError("");
        await updateMeter(meter.id, result.fields);
        toast({ message: "Einstellungen gespeichert", variant: "success" });
    };

    return (
        <div className="space-y-6 bg-card border border-border rounded-2xl p-4">
            <MeterTypeFields form={form} onChange={setForm} />
            <MeterCostFields form={form} onChange={setForm} idPrefix={`meter-${meter.id}`} />
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex justify-end">
                <button type="button" onClick={save} className="btn btn-primary py-2 px-4 text-xs font-black uppercase tracking-widest">
                    <Save className="w-3 h-3" />
                    Speichern
                </button>
            </div>
        </div>
    );
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section className="space-y-3">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-2 w-full text-left">
                <ChevronDown className={cn("w-4 h-4 opacity-50 transition-transform", !open && "-rotate-90")} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
            </button>
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

export function MeterDetailDialog({ meter, instance, onClose, onAddReading }: MeterDetailDialogProps) {
    const confirm = useConfirm();
    const Icon = meter ? METER_ICONS[meter.type].icon : null;

    return (
        <BaseDialog
            isOpen={!!meter}
            onClose={onClose}
            title={meter ? `${METER_TYPE_LABELS[meter.type]}zähler` : undefined}
            className="sm:max-w-2xl"
            footer={
                meter && (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={async () => {
                                const ok = await confirm({
                                    title: "Zähler löschen?",
                                    message: "Alle Ablesungen dieses Zählers werden ebenfalls gelöscht – auch für die anderen Mitglieder des Haushalts.",
                                    confirmLabel: "Endgültig löschen",
                                    danger: true,
                                });
                                if (ok) {
                                    onClose();
                                    await deleteMeter(meter.id);
                                }
                            }}
                            className="btn btn-danger py-3 px-4"
                            aria-label="Zähler löschen"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => onAddReading(meter.id)} className="flex-1 btn btn-primary py-3">
                            {Icon && <Icon className="w-4 h-4" />}
                            Ablesung eintragen
                        </button>
                    </div>
                )
            }
        >
            {meter && (
                <div key={`${meter.id}:${instance}`} className="space-y-8">
                    <Statistics meter={meter} />
                    <Collapsible title={`Verlauf (${meter.readings.length})`} defaultOpen>
                        <History_ meter={meter} />
                    </Collapsible>
                    <Collapsible title="Einstellungen & Kosten" defaultOpen={meter.pricePerUnit === null}>
                        <Settings meter={meter} />
                    </Collapsible>
                </div>
            )}
        </BaseDialog>
    );
}
