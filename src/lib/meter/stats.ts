import type { MeterFields, MeterType, Reading } from "@/lib/sync/types";

/*
 * Verbrauchsberechnung
 * ====================
 * Zwischen zwei Ablesungen wird der Verbrauch gleichmäßig auf die Zeit verteilt
 * (lineare Interpolation). Daraus lassen sich Verbräuche für beliebige Zeiträume
 * (Monate, Abrechnungsjahr, letzte 30 Tage) berechnen – auch wenn nicht exakt an
 * den Grenzen abgelesen wurde.
 *
 * Zählerwechsel: Eine Ablesung mit `isReplacement` beginnt einen neuen Zähler –
 * der Sprung zum neuen Startstand zählt nicht als Verbrauch.
 *
 * Fällt ein Stand ohne Zählerwechsel, wird lokal entschieden (siehe `toSegments`):
 * Ein einzelner Ausreißer nach oben oder unten (Tippfehler) wird nicht mitgerechnet.
 * Passt keins von beidem, war es vermutlich ein nicht markierter Zählerwechsel –
 * dann zählt nur der eine Abschnitt nicht.
 *
 * Details und Begründungen: docs/PRUEFUNG_ZAEHLER.md
 */

export const DAY_MS = 86_400_000;
export const YEAR_MS = 365.2425 * DAY_MS;
export const DAYS_PER_MONTH = 365.2425 / 12;

export interface Segment {
    start: number;
    end: number;
    consumption: number;
    /** Verbrauch pro Millisekunde */
    rate: number;
}

type ReadingLike = Pick<Reading, "value" | "date" | "isReplacement"> & { createdAt?: string };

// Reihenfolge -------------------------------------------------------------------------

/**
 * Sortiert Ablesungen eindeutig: nach Zeitpunkt, bei gleichem Zeitpunkt die normale
 * Ablesung (Endstand des alten Zählers) vor dem Zählerwechsel, dann nach Eintragungszeit.
 */
export function sortReadings<T extends ReadingLike>(readings: readonly T[]): T[] {
    const keyed = readings.map((r) => ({ r, t: Date.parse(r.date) }));
    const compare = (a: (typeof keyed)[number], b: (typeof keyed)[number]) =>
        a.t - b.t || Number(a.r.isReplacement) - Number(b.r.isReplacement) || (a.r.createdAt ?? "").localeCompare(b.r.createdAt ?? "");
    // Meist schon sortiert (z. B. aus der Datenbank) – dann spart das bei vielen Werten Zeit
    let sorted = true;
    for (let i = 1; i < keyed.length && sorted; i++) sorted = compare(keyed[i - 1], keyed[i]) <= 0;
    return (sorted ? keyed : keyed.sort(compare)).map((x) => x.r);
}

interface Analysis<T> {
    /** sortiert, ohne Ausreißer (die nicht mitgerechnet werden) */
    counted: T[];
    countedTimes: number[];
    /** üblicher Verbrauch pro Tag */
    usual: number | null;
}

// Pro Ablesungs-Liste nur einmal rechnen (Vorschau läuft bei jedem Tastendruck)
const analysisCache = new WeakMap<object, Analysis<ReadingLike>>();

function analyse<T extends ReadingLike>(readings: readonly T[]): Analysis<T> {
    const cached = analysisCache.get(readings);
    if (cached) return cached as Analysis<T>;
    const sorted = sortReadings(readings);
    const { segments, ignored } = toSegments(sorted);
    const skip = new Set<T>(ignored);
    const counted = skip.size ? sorted.filter((r) => !skip.has(r)) : sorted;
    const result: Analysis<T> = { counted, countedTimes: counted.map((r) => Date.parse(r.date)), usual: dailyAverage(segments) };
    analysisCache.set(readings, result as Analysis<ReadingLike>);
    return result;
}

/**
 * Vorherige und nächste Ablesung – nach der Position, an der die neue einsortiert würde
 * (gleicher Zeitpunkt: normale Ablesung vor Zählerwechsel, die neue als zuletzt eingetragene).
 */
function neighbours<T extends ReadingLike>(sorted: readonly T[], times: readonly number[], t: number, isReplacement: boolean) {
    let i = 0;
    while (i < sorted.length && (times[i] < t || (times[i] === t && (isReplacement || !sorted[i].isReplacement)))) i++;
    return { index: i, previous: sorted[i - 1] as T | undefined, next: sorted[i] as T | undefined };
}

/**
 * Zeitpunkt für eine Ablesung an einem Kalendertag (YYYY-MM-DD, lokale Zeit):
 * heute = jetzt; an vergangenen Tagen 12:00 (Zeitzonen verschieben so nicht den Tag).
 * Ist die Minute schon belegt, die nächste freie – so kommt ein weiterer Eintrag für
 * denselben Tag eindeutig danach (z. B. Endstand alter Zähler, dann neuer Zähler).
 */
export function timestampForDay(day: string, readings: readonly ReadingLike[], now = Date.now()): string {
    const [y, m, d] = day.split("-").map(Number);
    const dayStart = new Date(y, m - 1, d).getTime();
    const nextDay = new Date(y, m - 1, d + 1).getTime();
    if (now >= dayStart && now < nextDay) return new Date(now).toISOString();
    const taken = new Set<number>();
    for (const r of readings) {
        const t = Date.parse(r.date);
        if (t >= dayStart && t < nextDay) taken.add(Math.floor(t / 60_000));
    }
    let t = new Date(y, m - 1, d, 12).getTime();
    while (taken.has(t / 60_000) && t + 60_000 < nextDay) t += 60_000;
    return new Date(t).toISOString();
}

// Abschnitte --------------------------------------------------------------------------

export interface SegmentResult<T> {
    segments: Segment[];
    /** Ausreißer (vermutlich Tippfehler), die nicht mitgerechnet werden */
    ignored: T[];
    /** Niedriger als der vorherige Stand ohne Zählerwechsel – der Abschnitt davor zählt nicht */
    drops: T[];
    /** ignored + drops */
    anomalies: number;
}

interface Point<T> {
    r: T;
    t: number;
    v: number;
    /** Abschnitt davor nicht werten (nicht markierter Zählerwechsel) */
    gap?: boolean;
}

/** Σ c²/d – je kleiner, desto gleichmäßiger der Verbrauch (bei gleicher Summe). */
function unevenness<T>(points: Point<T>[]): number {
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
        const c = points[i].v - points[i - 1].v;
        const d = points[i].t - points[i - 1].t;
        if (d > 0) sum += (c * c) / d;
    }
    return sum;
}

/**
 * Bereinigt die Ablesungen eines Zählers (zwischen zwei Zählerwechseln). Bei jedem
 * Rückgang von a auf b:
 *  - a ist eine Spitze, wenn der Stand vor a ≤ b ist (oder a der erste ist) → a fällt weg
 *  - b ist eine Delle, wenn a ≤ dem Stand nach b ist (oder b der letzte ist) → b fällt weg
 *  - beides möglich: kleinerer Verbrauch im Bereich gewinnt, dann der gleichmäßigere
 *  - nichts davon: nicht markierter Zählerwechsel → nur dieser Abschnitt zählt nicht
 */
function cleanRun<T>(run: Point<T>[], ignored: T[], drops: T[]): Point<T>[] {
    const kept: Point<T>[] = [];
    for (let i = 0; i < run.length; i++) {
        const b = run[i];
        const a = kept[kept.length - 1];
        if (!a || b.v >= a.v) {
            kept.push(b);
            continue;
        }
        const before = a.gap ? undefined : kept[kept.length - 2];
        const after = run[i + 1];
        if (!before && !after) {
            // nur zwei Stände: nicht entscheidbar
            kept.push({ ...b, gap: true });
            drops.push(b.r);
            continue;
        }
        const spike = !before || before.v <= b.v;
        const dip = !after || a.v <= after.v;
        let dropA = spike && !dip;
        if (spike && dip) {
            const withB = [before, b, after].filter((p): p is Point<T> => !!p);
            const withA = [before, a, after].filter((p): p is Point<T> => !!p);
            const total = (ps: Point<T>[]) => ps[ps.length - 1].v - ps[0].v;
            const diff = total(withB) - total(withA);
            dropA = diff < 0 || (diff === 0 && unevenness(withB) < unevenness(withA));
        }
        if (dropA) {
            kept.pop();
            ignored.push(a.r);
            kept.push(a.gap ? { ...b, gap: true } : b);
        } else if (spike || dip) {
            ignored.push(b.r);
        } else {
            kept.push({ ...b, gap: true });
            drops.push(b.r);
        }
    }
    return kept;
}

export function toSegments<T extends ReadingLike>(readings: readonly T[]): SegmentResult<T> {
    // Gleicher Zeitpunkt und gleiche Art: der zuletzt eingetragene Stand gilt
    const points: Point<T>[] = [];
    for (const r of sortReadings(readings)) {
        const p = { r, t: Date.parse(r.date), v: r.value };
        const last = points[points.length - 1];
        if (last && last.t === p.t && last.r.isReplacement === r.isReplacement) points[points.length - 1] = p;
        else points.push(p);
    }
    // Jeder Zählerwechsel beginnt einen neuen Zähler
    const runs: Point<T>[][] = [];
    for (const p of points) {
        if (p.r.isReplacement || !runs.length) runs.push([p]);
        else runs[runs.length - 1].push(p);
    }

    const ignored: T[] = [];
    const drops: T[] = [];
    const segments: Segment[] = [];
    for (const run of runs) {
        const kept = cleanRun(run, ignored, drops);
        for (let i = 1; i < kept.length; i++) {
            const a = kept[i - 1];
            const b = kept[i];
            if (b.gap || !(b.t > a.t)) continue;
            const consumption = b.v - a.v;
            segments.push({ start: a.t, end: b.t, consumption, rate: consumption / (b.t - a.t) });
        }
    }
    return { segments, ignored, drops, anomalies: ignored.length + drops.length };
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

/** "m³", auch als "m3" geschrieben */
export const isCubicMeters = (unit: string) => /^m[³3]$/i.test(unit.trim());

/** Gas mit Preis pro kWh, Zähler misst nicht in kWh → Umrechnung nötig. */
export function needsConversion(meter: CostFields): boolean {
    return meter.type === "GAS" && meter.priceUnit === "kwh" && !/^kwh$/i.test(meter.unit.trim());
}

/** Umrechnung nötig, aber nicht möglich (keine m³ oder Zustandszahl/Brennwert fehlen). */
export function conversionMissing(meter: CostFields): boolean {
    return needsConversion(meter) && !(isCubicMeters(meter.unit) && (meter.zNumber ?? 0) > 0 && (meter.calorificValue ?? 0) > 0);
}

/** Faktor Zählereinheit → Abrechnungseinheit (Gas: m³ × Zustandszahl × Brennwert = kWh). */
export function billingFactor(meter: CostFields): number {
    return needsConversion(meter) && !conversionMissing(meter) ? meter.zNumber! * meter.calorificValue! : 1;
}

/** Kosten lassen sich nur mit Preis und vollständiger Umrechnung berechnen – sonst lieber gar keine Zahl. */
export function canComputeCost(meter: CostFields): boolean {
    return (meter.pricePerUnit ?? 0) > 0 && !conversionMissing(meter);
}

/** Kosten (Arbeitspreis) für einen Verbrauch in Zählereinheiten. */
export function consumptionCost(meter: CostFields, consumption: number): number {
    return consumption * billingFactor(meter) * (meter.pricePerUnit ?? 0);
}

// Abrechnungsjahr ---------------------------------------------------------------------

/**
 * Typischer Gasverbrauch je Monat in % des Jahres (Heizung nach Gradtagzahlen plus
 * Warmwasser). Nur für Schätzungen ohne Vorjahresdaten.
 */
export const GAS_PROFILE = [15.6, 13.7, 12.3, 8.6, 5.2, 3.1, 2.6, 2.6, 3.8, 7.6, 11.4, 13.5];

/** Anteil am Jahresverbrauch im Zeitraum [from, to]. */
type Weight = (from: number, to: number) => number;

const flatWeight: Weight = (from, to) => Math.max(0, to - from) / YEAR_MS;

const monthBounds = new Map<number, [number, number]>();
function monthRange(y: number, m: number): [number, number] {
    const key = y * 12 + m;
    let b = monthBounds.get(key);
    if (!b) monthBounds.set(key, (b = [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()]));
    return b;
}

const gasWeight: Weight = (from, to) => {
    if (!(to > from)) return 0;
    const first = new Date(from);
    let y = first.getFullYear();
    let m = first.getMonth();
    let w = 0;
    for (;;) {
        const [monthStart, monthEnd] = monthRange(y, m);
        if (monthStart >= to) break;
        const overlap = Math.min(monthEnd, to) - Math.max(monthStart, from);
        if (overlap > 0) w += ((GAS_PROFILE[m] / 100) * overlap) / (monthEnd - monthStart);
        m++;
        if (m === 12) {
            m = 0;
            y++;
        }
    }
    return w;
};

/** Anteil am Jahresverbrauch, der im Zeitraum [from, to] durch Ablesungen abgedeckt ist. */
function coveredWeight(segments: Segment[], from: number, to: number, weight: Weight): number {
    let w = 0;
    for (const s of segments) {
        const a = Math.max(s.start, from);
        const b = Math.min(s.end, to);
        if (b > a) w += weight(a, b);
    }
    return w;
}

export interface BillingProjection {
    periodStart: number;
    periodEnd: number;
    /** Verbrauch bisher (bis zur letzten Ablesung, Lücken geschätzt) */
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
    basis: "last-year" | "profile" | "average";
    /** Weniger als ein Viertel des Jahresverbrauchs gemessen – die Hochrechnung kann stark danebenliegen */
    uncertain: boolean;
}

/** Erst ab so viel gemessener Zeit wird hochgerechnet – aus ein paar Stunden lässt sich kein Jahr ableiten. */
export const MIN_PROJECTION_DAYS = 14;

function billingAnchor(billingStart: string | null): [month: number, day: number] {
    if (!billingStart) return [0, 1];
    const [, m, d] = billingStart.split("-").map(Number);
    return [m - 1, d];
}

/** Jahrestag; der 29.02. wird in Nicht-Schaltjahren zum 28.02. (nicht zum 01.03.). */
function anniversary(year: number, month: number, day: number): number {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, daysInMonth)).getTime();
}

/** Beginn des aktuellen Abrechnungsjahres (Jahrestag von `billingStart` ≤ `now`). */
export function currentPeriodStart(billingStart: string | null, now: number): number {
    const [month, day] = billingAnchor(billingStart);
    const year = new Date(now).getFullYear();
    const start = anniversary(year, month, day);
    return start > now ? anniversary(year - 1, month, day) : start;
}

function currentPeriodEnd(billingStart: string | null, periodStart: number): number {
    const [month, day] = billingAnchor(billingStart);
    return anniversary(new Date(periodStart).getFullYear() + 1, month, day);
}

export function projectBillingPeriod(
    meter: CostFields & { billingStart: string | null },
    segments: Segment[],
    now = Date.now(),
): BillingProjection | null {
    if (!segments.length) return null;
    // Gas verteilt sich stark übers Jahr, Strom und Wasser kaum
    const weight = meter.type === "GAS" ? gasWeight : flatWeight;
    let measured = 0;
    let measuredWeight = 0;
    let measuredMs = 0;
    for (const s of segments) {
        measured += s.consumption;
        measuredWeight += weight(s.start, s.end);
        measuredMs += s.end - s.start;
    }
    if (measuredMs < MIN_PROJECTION_DAYS * DAY_MS || !(measuredWeight > 0)) return null;
    /** Jahresverbrauch, hochgerechnet aus allen Ablesungen */
    const annual = measured / measuredWeight;

    const periodStart = currentPeriodStart(meter.billingStart, now);
    const periodEnd = currentPeriodEnd(meter.billingStart, periodStart);
    const lastReading = segments[segments.length - 1].end;
    const knownUntil = Math.min(Math.max(lastReading, periodStart), periodEnd);

    // Bisher: gemessen + Lücken geschätzt
    const soFar = consumptionBetween(segments, periodStart, knownUntil);
    const gapWeight = Math.max(0, weight(periodStart, knownUntil) - coveredWeight(segments, periodStart, knownUntil, weight));
    const consumptionSoFar = soFar.consumption + gapWeight * annual;

    // Rest des Jahres: wenn möglich der gleiche Zeitraum im Vorjahr (Saison, Gewohnheiten)
    const lastYearFrom = knownUntil - YEAR_MS;
    const lastYearTo = periodEnd - YEAR_MS;
    const lastYear = consumptionBetween(segments, lastYearFrom, lastYearTo);
    const remainingWeight = weight(knownUntil, periodEnd);
    let remaining: number;
    let basis: BillingProjection["basis"];
    let estimatedWeight = gapWeight;
    if (periodEnd > knownUntil && lastYear.coverage >= 0.8) {
        const lastYearGap = Math.max(0, weight(lastYearFrom, lastYearTo) - coveredWeight(segments, lastYearFrom, lastYearTo, weight));
        remaining = lastYear.consumption + lastYearGap * annual;
        basis = "last-year";
    } else {
        remaining = remainingWeight * annual;
        basis = meter.type === "GAS" ? "profile" : "average";
        estimatedWeight += remainingWeight;
    }
    const projectedConsumption = consumptionSoFar + Math.max(0, remaining);

    const projectedCost = canComputeCost(meter) ? consumptionCost(meter, projectedConsumption) + (meter.basicFee ?? 0) * 12 : null;
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
        uncertain: estimatedWeight > 0.01 && measuredWeight < 0.25,
    };
}

// Plausibilität -----------------------------------------------------------------------

export type PlausibilityIssue =
    | { kind: "lower-than-previous"; previous: number; /** der vorherige Stand sieht selbst nach einem Tippfehler aus */ previousSuspicious: boolean }
    | { kind: "higher-than-next"; next: number; nextDate: string }
    | { kind: "unusually-high"; dailyRate: number; usualRate: number }
    | { kind: "big-jump"; dailyRate: number; previous: number; /** vielfacher Stand statt hoher Tagesrate */ ratio: boolean }
    | { kind: "future-date" };

export interface ReadingPreview {
    previous: ReadingLike;
    /** spätere Ablesung, falls in die Vergangenheit nachgetragen wird */
    next?: ReadingLike;
    /** Verbrauch seit der vorherigen Ablesung (negativ = niedrigerer Stand) */
    consumption: number;
    days: number;
    /** nur bei mindestens einem Tag Abstand aussagekräftig */
    perDay: number | null;
}

/**
 * Was eine neue Ablesung bedeutet – für die Vorschau beim Eintippen.
 * Verglichen wird mit den mitgerechneten Ständen (ein erkannter Tippfehler zählt nicht).
 */
export function previewReading(readings: readonly ReadingLike[], candidate: ReadingLike): ReadingPreview | null {
    if (candidate.isReplacement) return null;
    const t = Date.parse(candidate.date);
    const { counted, countedTimes } = analyse(readings);
    const { previous, next } = neighbours(counted, countedTimes, t, false);
    if (!previous) return null;
    const consumption = candidate.value - previous.value;
    const days = (t - Date.parse(previous.date)) / DAY_MS;
    return { previous, next, consumption, days, perDay: days >= 1 ? consumption / days : null };
}

/**
 * Großzügige Obergrenze pro Tag, solange es noch kein Verbrauchsmuster gibt.
 * Fängt eine Ziffer zu viel ab, ohne neue Zähler mit kleinem Startstand zu stören.
 */
export function maxDailyRate(meter?: { type: MeterType; unit: string }): number | null {
    if (!meter) return 150;
    const unit = meter.unit.trim().toLowerCase();
    if (unit === "kwh") return meter.type === "GAS" ? 400 : 150;
    if (isCubicMeters(unit)) return meter.type === "WATER" ? 5 : 40;
    if (unit === "l") return 5000;
    return null; // eigene Einheit: keine Annahme
}

/** Prüft eine Ablesung gegen die übrigen – für Warnungen vor dem Speichern. */
export function checkReading(
    readings: readonly ReadingLike[],
    candidate: ReadingLike,
    now = Date.now(),
    meter?: { type: MeterType; unit: string },
): PlausibilityIssue | null {
    const t = Date.parse(candidate.date);
    if (t > now + 5 * 60_000) return { kind: "future-date" };
    if (candidate.isReplacement) return null;
    const { counted, countedTimes, usual } = analyse(readings);
    const { index, previous, next } = neighbours(counted, countedTimes, t, false);
    if (previous && candidate.value < previous.value) {
        const beforePrevious = previous.isReplacement ? undefined : counted[index - 2];
        return {
            kind: "lower-than-previous",
            previous: previous.value,
            previousSuspicious: !!beforePrevious && beforePrevious.value <= candidate.value,
        };
    }
    // Nachtrag in die Vergangenheit: darf nicht über einer späteren Ablesung liegen
    if (next && !next.isReplacement && candidate.value > next.value) return { kind: "higher-than-next", next: next.value, nextDate: next.date };
    if (!previous) return null;

    const increase = candidate.value - previous.value;
    // Kurze Abstände (z. B. zweimal am selben Tag) wie einen ganzen Tag behandeln,
    // sonst fällt eine Ziffer zu viel gerade dann nicht auf.
    const days = Math.max((t - Date.parse(previous.date)) / DAY_MS, 1);
    const dailyRate = increase / days;
    if (usual && usual > 0) {
        if (dailyRate > usual * 5 && dailyRate - usual > 1) return { kind: "unusually-high", dailyRate, usualRate: usual };
    } else {
        // Noch kein Verbrauchsmuster: hohe Tagesrate – oder nach langer Zeit ein Vielfaches des Stands (Ziffer zu viel)
        const max = maxDailyRate(meter);
        if (max !== null && dailyRate > max) return { kind: "big-jump", dailyRate, previous: previous.value, ratio: false };
        if (previous.value >= 1000 && candidate.value >= previous.value * 8) return { kind: "big-jump", dailyRate, previous: previous.value, ratio: true };
    }
    return null;
}
