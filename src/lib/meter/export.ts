import { formatNumber } from "@/lib/numbers";
import type { Reading } from "@/lib/sync/types";
import { METER_TYPE_LABELS } from "./format";
import type { MeterType } from "@/lib/sync/types";

/** CSV im deutschen Excel-Format (Semikolon, Dezimalkomma, UTF-8 mit BOM). */
export function readingsToCsv(readings: Reading[], unit: string): string {
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    const rows = [["Datum", "Uhrzeit", `Stand (${unit})`, `Verbrauch seit vorheriger (${unit})`, "Zählerwechsel", "Quelle"]];
    sorted.forEach((r, i) => {
        const d = new Date(r.date);
        const prev = sorted[i - 1];
        const delta = prev && !r.isReplacement ? formatNumber(r.value - prev.value, 4, 0) : "";
        rows.push([
            d.toLocaleDateString("de-DE"),
            d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
            formatNumber(r.value, 4, 0).replace(/\./g, ""),
            delta.replace(/\./g, ""),
            r.isReplacement ? "ja" : "",
            r.source === "api" ? "automatisch" : "App",
        ]);
    });
    return "﻿" + rows.map((row) => row.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
}

export async function shareOrDownloadCsv(csv: string, type: MeterType) {
    const name = `${METER_TYPE_LABELS[type].toLowerCase()}-ablesungen-${new Date().toISOString().slice(0, 10)}.csv`;
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
