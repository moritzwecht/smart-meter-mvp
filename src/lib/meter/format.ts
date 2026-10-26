import { formatNumber } from "@/lib/numbers";
import type { MeterType } from "@/lib/sync/types";

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

/** Verbrauch je nach Größe sinnvoll gerundet. */
export function formatConsumption(value: number): string {
    const abs = Math.abs(value);
    return formatNumber(value, abs >= 100 ? 0 : abs >= 10 ? 1 : 2, 0);
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
