import { formatNumber } from "@/lib/numbers";
import type { MeterType } from "@/lib/sync/types";
import type { PlausibilityIssue } from "./stats";

export const METER_TYPE_LABELS: Record<MeterType, string> = {
    ELECTRICITY: "Strom",
    WATER: "Wasser",
    GAS: "Gas",
};

export const METER_UNITS = ["kWh", "m³", "l"];

export const DEFAULT_UNIT: Record<MeterType, string> = {
    ELECTRICITY: "kWh",
    WATER: "m³",
    GAS: "m³",
};

/** Zählerstand: bis zu 3 Nachkommastellen, keine überflüssigen Nullen. */
export function formatReading(value: number): string {
    return formatNumber(value, 3, 0);
}

/** Verbrauch je nach Größe sinnvoll gerundet – mit fester Stellenzahl, damit Werte vergleichbar aussehen (4,40 neben 4,08). */
export function formatConsumption(value: number): string {
    const digits = (n: number) => (n >= 100 ? 0 : n >= 10 ? 1 : 2);
    // Stellenzahl nach dem Runden bestimmen: 9,9996 → „10,0“, nicht „10,00“
    const decimals = digits(Math.abs(Number(value.toFixed(digits(Math.abs(value))))));
    return formatNumber(value, decimals, decimals);
}

/** Verbrauch zwischen zwei Ständen: genau wie abgelesen, höchstens eine Nachkommastelle ab 100, sonst zwei. */
export function formatAmount(value: number): string {
    return formatNumber(value, Math.abs(value) >= 100 ? 1 : 2, 0);
}

/** Differenz mit Vorzeichen: „+8,2“ bzw. „−584,9“ (echtes Minuszeichen wie überall in der App). */
export function formatDelta(value: number): string {
    const text = formatAmount(Math.abs(value));
    return value < 0 ? `−${text}` : `+${text}`;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "short" });

export const formatDate = (iso: string | number) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string | number) => dateTimeFormat.format(new Date(iso));
export const formatMonthShort = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split("-").map(Number);
    return monthFormat.format(new Date(y, m - 1, 1));
};

const relative = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

/** "heute", "gestern", "vor 5 Tagen", "vor 3 Monaten" */
export function formatRelativeDay(iso: string, now = Date.now()): string {
    const startOfDay = (t: number) => new Date(new Date(t).toDateString()).getTime();
    const days = Math.round((startOfDay(Date.parse(iso)) - startOfDay(now)) / 86_400_000);
    if (Math.abs(days) < 45) return relative.format(days, "day");
    const months = Math.round(days / 30.44);
    if (Math.abs(months) < 18) return relative.format(months, "month");
    return relative.format(Math.round(days / 365.24), "year");
}

/** <input type="date">-Wert (lokale Zeitzone) */
export function toDateInputValue(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Warnung zu einer Ablesung, wie sie im Formular erscheint. */
export function plausibilityText(issue: PlausibilityIssue, unit: string): string {
    switch (issue.kind) {
        case "future-date":
            return "Das Datum liegt in der Zukunft.";
        case "lower-than-previous":
            return issue.previousSuspicious
                ? `Der Stand ist niedriger als die vorherige Ablesung (${formatReading(issue.previous)} ${unit}). Stimmt der neue Wert, war die vorherige vermutlich ein Tippfehler – sie wird dann nicht mitgerechnet und lässt sich im Verlauf korrigieren.`
                : `Der Stand ist niedriger als die vorherige Ablesung (${formatReading(issue.previous)} ${unit}). Tippfehler – oder wurde der Zähler getauscht?`;
        case "higher-than-next":
            return `Der Stand ist höher als die spätere Ablesung vom ${formatDate(issue.nextDate)} (${formatReading(issue.next)} ${unit}). Stimmt der Wert?`;
        case "unusually-high":
            return `Das wären ${formatConsumption(issue.dailyRate)} ${unit} pro Tag – üblich sind ca. ${formatConsumption(issue.usualRate)} ${unit}. Erwartet etwa ${formatReading(Math.round(issue.expected))} ${unit}. Eine Ziffer zu viel oder das Komma verrutscht?`;
        case "big-jump":
            return issue.ratio
                ? `Der Wert ist ein Vielfaches des vorherigen Stands (${formatReading(issue.previous)} ${unit}). Stimmt der Wert?`
                : `Das wären ${formatConsumption(issue.dailyRate)} ${unit} pro Tag – ungewöhnlich viel. Stimmt der Wert?`;
    }
}
