import { formatNumber } from "@/lib/numbers";
import type { MeterType, Reading } from "@/lib/sync/types";
import { METER_TYPE_LABELS } from "./format";
import { customMeterName } from "./names";
import { readingFlags, sortReadings } from "./stats";

/**
 * CSV im deutschen Excel-Format (Semikolon, Dezimalkomma, UTF-8 mit BOM).
 * Differenzen wie im Verlauf: gegen die vorherige mitgerechnete Ablesung; Tippfehler und
 * nicht markierte Zählerwechsel stehen in der Spalte „Hinweis“.
 */
export function readingsToCsv(readings: Reading[], unit: string): string {
    const sorted = sortReadings(readings);
    const { flags, previousOf } = readingFlags(sorted);
    const rows = [["Datum", "Uhrzeit", `Stand (${unit})`, `Verbrauch seit vorheriger (${unit})`, "Zählerwechsel", "Quelle", "Hinweis"]];
    for (const r of sorted) {
        const d = new Date(r.date);
        const prev = previousOf.get(r);
        const delta = prev && !r.isReplacement ? formatNumber(r.value - prev.value, 4, 0) : "";
        const flag = flags.get(r);
        rows.push([
            d.toLocaleDateString("de-DE"),
            d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
            formatNumber(r.value, 4, 0).replace(/\./g, ""),
            delta.replace(/\./g, ""),
            r.isReplacement ? "ja" : "",
            r.source === "api" ? "automatisch" : "App",
            flag === "ignored" ? "Tippfehler? Zählt nicht mit" : flag === "drop" ? "Stand gesunken – Zählerwechsel?" : "",
        ]);
    }
    return "﻿" + rows.map((row) => row.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
}

/** Dateiname aus Typ und ggf. eigenem Namen, z. B. „strom-waermepumpe-ablesungen-2026-10-26.csv“ */
function fileName(meter: { type: MeterType; name?: string | null }) {
    const custom = customMeterName(meter);
    const slug = [METER_TYPE_LABELS[meter.type], custom]
        .filter(Boolean)
        .join("-")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `${slug}-ablesungen-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function shareOrDownloadCsv(csv: string, meter: { type: MeterType; name?: string | null }) {
    const name = fileName(meter);
    const file = new File([csv], name, { type: "text/csv" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: name });
            return;
        } catch (error) {
            if ((error as Error).name === "AbortError") return;
        }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
