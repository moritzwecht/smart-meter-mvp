import type { MeterFields, Reading } from "@/lib/sync/types";

/*
 * Verbrauchsberechnung
 * ====================
 * Zwischen zwei Ablesungen wird der Verbrauch gleichmäßig auf die Zeit verteilt
 * (lineare Interpolation). Daraus lassen sich Verbräuche für beliebige Zeiträume
 * (Monate, Abrechnungsjahr, letzte 30 Tage) berechnen – auch wenn nicht exakt an
 * den Grenzen abgelesen wurde.
 *
 * Zählerwechsel: Eine Ablesung mit `isReplacement` beginnt einen neuen Zähler –
 * der Abschnitt davor wird nicht als (negativer) Verbrauch gewertet.
 * Negative Abschnitte ohne Zählerwechsel gelten als Tippfehler und werden ignoriert.
 */

export const DAY_MS = 86_400_000;
export const DAYS_PER_MONTH = 365.2425 / 12;

export interface Segment {
    start: number;
    end: number;
    consumption: number;
    /** Verbrauch pro Millisekunde */
    rate: number;
}

type ReadingLike = Pick<Reading, "value" | "date" | "isReplacement">;

export function toSegments(readings: ReadingLike[]): { segments: Segment[]; anomalies: number } {
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    const segments: Segment[] = [];
    let anomalies = 0;
    for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        if (b.isReplacement) continue;
        const start = Date.parse(a.date);
        const end = Date.parse(b.date);
        const consumption = b.value - a.value;
        if (!(end > start)) continue;
        if (consumption < 0) {
            anomalies++;
            continue;
        }
        segments.push({ start, end, consumption, rate: consumption / (end - start) });
    }
    return { segments, anomalies };
}

/** Verbrauch im Zeitraum [from, to] und wie viel davon durch Ablesungen abgedeckt ist. */
export function consumptionBetween(segments: Segment[], from: number, to: number) {
    let consumption = 0;
    let coveredMs = 0;
    for (const s of segments) {
        const overlap = Math.min(s.end, to) - Math.max(s.start, from);
        if (overlap > 0) {
            consumption += s.rate * overlap;
            coveredMs += overlap;
        }
    }
    return { consumption, coveredMs, coverage: to > from ? coveredMs / (to - from) : 0 };
}

export function dailyAverage(segments: Segment[]): number | null {
    let total = 0;
    let ms = 0;
    for (const s of segments) {
        total += s.consumption;
        ms += s.end - s.start;
    }
    return ms > 0 ? (total / ms) * DAY_MS : null;
}

/** Ø pro Tag in den letzten `days` Tagen bis zur letzten Ablesung. */
export function recentDailyAverage(segments: Segment[], days = 30): number | null {
    if (!segments.length) return null;
    const end = segments[segments.length - 1].end;
    const { consumption, coveredMs } = consumptionBetween(segments, end - days * DAY_MS, end);
    return coveredMs > 0 ? (consumption / coveredMs) * DAY_MS : null;
}

export interface MonthBucket {
    /** YYYY-MM */
    month: string;
    consumption: number;
    /** Anteil des Monats, der durch Ablesungen abgedeckt ist (0–1) */
    coverage: number;
}

export function monthlyConsumption(segments: Segment[], maxMonths = 24): MonthBucket[] {
    if (!segments.length) return [];
    const first = new Date(segments[0].start);
    const last = new Date(segments[segments.length - 1].end);
    const buckets: MonthBucket[] = [];
    let y = first.getFullYear();
    let m = first.getMonth();
    while (y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth())) {
        const from = new Date(y, m, 1).getTime();
        const to = new Date(y, m + 1, 1).getTime();
        const { consumption, coverage } = consumptionBetween(segments, from, to);
        buckets.push({ month: `${y}-${String(m + 1).padStart(2, "0")}`, consumption, coverage });
        m++;
        if (m === 12) {
            m = 0;
            y++;
        }
    }
    return buckets.slice(-maxMonths);
}

// Kosten ------------------------------------------------------------------------------

type CostFields = Pick<MeterFields, "type" | "pricePerUnit" | "priceUnit" | "zNumber" | "calorificValue" | "basicFee" | "monthlyPayment"> & {
    unit: string;
};

/** Faktor Zählereinheit → Abrechnungseinheit (Gas: m³ × Zustandszahl × Brennwert = kWh). */
export function billingFactor(meter: CostFields): number {
    if (meter.type === "GAS" && meter.unit === "m³" && meter.priceUnit === "kwh") {
        return (meter.zNumber ?? 1) * (meter.calorificValue ?? 1);
    }
    return 1;
}

export function canComputeCost(meter: CostFields): boolean {
    return (meter.pricePerUnit ?? 0) > 0;
}

/** Kosten (Arbeitspreis) für einen Verbrauch in Zählereinheiten. */
export function consumptionCost(meter: CostFields, consumption: number): number {
    return consumption * billingFactor(meter) * (meter.pricePerUnit ?? 0);
}

// Abrechnungsjahr ---------------------------------------------------------------------

export interface BillingProjection {
    periodStart: number;
    periodEnd: number;
    /** Verbrauch bisher (bis zur letzten Ablesung) */
    consumptionSoFar: number;
    /** Hochgerechneter Verbrauch für das ganze Abrechnungsjahr */
    projectedConsumption: number;
    /** Kosten inkl. Grundgebühr (12 × monatlich) */
    projectedCost: number | null;
    /** Summe der Abschläge im Jahr */
    payments: number | null;
    /** > 0 = Guthaben, < 0 = Nachzahlung */
    balance: number | null;
    /** Woher die Hochrechnung für den Rest des Jahres kommt */
    basis: "last-year" | "average";
}

/** Beginn des aktuellen Abrechnungsjahres (Jahrestag von `billingStart` ≤ `now`). */
export function currentPeriodStart(billingStart: string | null, now: number): number {
    const today = new Date(now);
    let month = 0;
    let day = 1;
    if (billingStart) {
        const [, m, d] = billingStart.split("-").map(Number);
        month = m - 1;
        day = d;
    }
    let start = new Date(today.getFullYear(), month, day).getTime();
    if (start > now) start = new Date(today.getFullYear() - 1, month, day).getTime();
    return start;
}

export function projectBillingPeriod(
    meter: CostFields & { billingStart: string | null },
    segments: Segment[],
    now = Date.now(),
): BillingProjection | null {
    const avg = dailyAverage(segments);
    if (avg === null) return null;
    const periodStart = currentPeriodStart(meter.billingStart, now);
    const periodEnd = new Date(new Date(periodStart).setFullYear(new Date(periodStart).getFullYear() + 1)).getTime();
    const lastReading = segments[segments.length - 1].end;
    const knownUntil = Math.min(Math.max(lastReading, periodStart), periodEnd);

    const soFar = consumptionBetween(segments, periodStart, knownUntil);
    // Lücken im bisherigen Zeitraum mit dem Durchschnitt füllen
    const gapMs = knownUntil - periodStart - soFar.coveredMs;
    const consumptionSoFar = soFar.consumption + Math.max(0, gapMs) * (avg / DAY_MS);

    // Rest des Jahres: wenn vorhanden, Verbrauch im gleichen Zeitraum des Vorjahres (Saisonalität!)
    const year = 365.2425 * DAY_MS;
    const lastYear = consumptionBetween(segments, knownUntil - year, periodEnd - year);
    const remainingMs = periodEnd - knownUntil;
    let remaining: number;
    let basis: BillingProjection["basis"];
    if (remainingMs > 0 && lastYear.coverage >= 0.8) {
        remaining = lastYear.consumption / lastYear.coverage;
        basis = "last-year";
    } else {
        remaining = remainingMs * (avg / DAY_MS);
        basis = "average";
    }
    const projectedConsumption = consumptionSoFar + Math.max(0, remaining);

    const projectedCost = canComputeCost(meter)
        ? consumptionCost(meter, projectedConsumption) + (meter.basicFee ?? 0) * 12
        : null;
    const payments = meter.monthlyPayment ? meter.monthlyPayment * 12 : null;
    return {
        periodStart,
        periodEnd,
        consumptionSoFar,
        projectedConsumption,
        projectedCost,
        payments,
        balance: projectedCost !== null && payments !== null ? payments - projectedCost : null,
        basis,
    };
}

// Plausibilität -----------------------------------------------------------------------

export type PlausibilityIssue =
    | { kind: "lower-than-previous"; previous: number }
    | { kind: "unusually-high"; dailyRate: number; usualRate: number }
    | { kind: "future-date" };

/** Prüft eine neue Ablesung gegen die bisherigen – für Warnungen vor dem Speichern. */
export function checkReading(readings: ReadingLike[], candidate: ReadingLike, now = Date.now()): PlausibilityIssue | null {
    const t = Date.parse(candidate.date);
    if (t > now + 5 * 60_000) return { kind: "future-date" };
    if (candidate.isReplacement) return null;
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    const previous = [...sorted].reverse().find((r) => Date.parse(r.date) <= t);
    if (!previous) return null;
    if (candidate.value < previous.value) return { kind: "lower-than-previous", previous: previous.value };
    const usual = dailyAverage(toSegments(sorted).segments);
    const days = (t - Date.parse(previous.date)) / DAY_MS;
    if (usual && usual > 0 && days > 0.5) {
        const dailyRate = (candidate.value - previous.value) / days;
        if (dailyRate > usual * 5 && dailyRate - usual > 1) return { kind: "unusually-high", dailyRate, usualRate: usual };
    }
    return null;
}
