import { describe, expect, it } from "vitest";
import {
    billingFactor,
    checkReading,
    consumptionBetween,
    currentPeriodStart,
    DAY_MS,
    dailyAverage,
    monthlyConsumption,
    projectBillingPeriod,
    recentDailyAverage,
    toSegments,
} from "@/lib/meter/stats";

const r = (date: string, value: number, isReplacement = false) => ({ date: new Date(date).toISOString(), value, isReplacement });

const baseMeter = {
    type: "ELECTRICITY" as const,
    unit: "kWh",
    pricePerUnit: 0.3,
    priceUnit: null,
    zNumber: null,
    calorificValue: null,
    basicFee: 10,
    monthlyPayment: 100,
    billingStart: "2025-01-01",
};

describe("Verbrauch", () => {
    it("berechnet den Tagesdurchschnitt über alle Abschnitte", () => {
        const { segments } = toSegments([r("2025-01-01", 1000), r("2025-01-11", 1100), r("2025-01-21", 1300)]);
        expect(dailyAverage(segments)).toBeCloseTo(15); // 300 kWh / 20 Tage
    });

    it("ignoriert den Sprung beim Zählerwechsel", () => {
        const { segments, anomalies } = toSegments([
            r("2025-01-01", 9900),
            r("2025-01-11", 10000),
            r("2025-01-12", 0, true), // neuer Zähler
            r("2025-01-22", 100),
        ]);
        expect(anomalies).toBe(0);
        expect(segments.map((s) => s.consumption)).toEqual([100, 100]);
        expect(dailyAverage(segments)).toBeCloseTo(10);
    });

    it("wertet einen zu niedrigen Stand als Tippfehler statt als negativen Verbrauch", () => {
        const { segments, anomalies, ignored } = toSegments([r("2025-01-01", 1000), r("2025-01-11", 900), r("2025-01-21", 1100)]);
        expect(anomalies).toBe(1);
        expect(ignored.map((x) => x.value)).toEqual([900]);
        expect(segments).toHaveLength(1);
        expect(segments[0].consumption).toBe(100);
    });

    it("interpoliert Verbrauch auf beliebige Zeiträume", () => {
        const { segments } = toSegments([r("2025-01-01T00:00:00Z", 0), r("2025-01-31T00:00:00Z", 300)]);
        const half = consumptionBetween(segments, Date.parse("2025-01-01T00:00:00Z"), Date.parse("2025-01-16T00:00:00Z"));
        expect(half.consumption).toBeCloseTo(150);
        expect(half.coverage).toBeCloseTo(1);
    });

    it("Ø der letzten 30 Tage spiegelt aktuelle Änderungen wider", () => {
        const { segments } = toSegments([r("2025-01-01", 0), r("2025-11-01", 3040), r("2025-12-01", 3340)]);
        expect(dailyAverage(segments)).toBeCloseTo(3340 / 334, 1);
        expect(recentDailyAverage(segments, 30)).toBeCloseTo(10, 1);
    });

    it("liefert Monatswerte mit Abdeckung", () => {
        const { segments } = toSegments([r("2025-01-15T12:00:00", 0), r("2025-03-15T12:00:00", 590)]);
        const months = monthlyConsumption(segments);
        expect(months.map((m) => m.month)).toEqual(["2025-01", "2025-02", "2025-03"]);
        expect(months[1].coverage).toBeCloseTo(1);
        expect(months[1].consumption).toBeCloseTo(280); // 28 Tage × 10 kWh
        expect(months[0].coverage).toBeLessThan(1);
    });
});

describe("Kosten & Prognose", () => {
    it("rechnet Gas von m³ in kWh um", () => {
        expect(billingFactor({ ...baseMeter, type: "GAS", unit: "m³", priceUnit: "kwh", zNumber: 0.95, calorificValue: 11.2 })).toBeCloseTo(10.64);
        expect(billingFactor({ ...baseMeter, type: "GAS", unit: "m³", priceUnit: null })).toBe(1);
    });

    it("bestimmt den Beginn des Abrechnungsjahres", () => {
        expect(new Date(currentPeriodStart("2024-03-01", Date.parse("2025-06-10"))).toDateString()).toBe(new Date(2025, 2, 1).toDateString());
        expect(new Date(currentPeriodStart("2024-09-01", Date.parse("2025-06-10"))).toDateString()).toBe(new Date(2024, 8, 1).toDateString());
        expect(new Date(currentPeriodStart(null, Date.parse("2025-06-10"))).toDateString()).toBe(new Date(2025, 0, 1).toDateString());
    });

    it("prognostiziert Verbrauch, Kosten und Guthaben", () => {
        // 10 kWh/Tag konstant seit Jahresbeginn, Stand 1. Juli
        const { segments } = toSegments([r("2025-01-01T00:00:00", 0), r("2025-07-01T00:00:00", 1810)]);
        const p = projectBillingPeriod(baseMeter, segments, new Date(2025, 6, 2).getTime())!;
        expect(p.consumptionSoFar).toBeCloseTo(1810, 0);
        expect(p.projectedConsumption).toBeCloseTo(3650, -1);
        expect(p.projectedCost).toBeCloseTo(3650 * 0.3 + 120, -1);
        expect(p.payments).toBe(1200);
        expect(p.balance).toBeCloseTo(1200 - (3650 * 0.3 + 120), -1);
        expect(p.basis).toBe("average");
    });

    it("nutzt für den Rest des Jahres das Vorjahr (Saisonalität)", () => {
        // Vorjahr: Winter viel, Sommer wenig
        const { segments } = toSegments([
            r("2024-01-01T00:00:00", 0),
            r("2024-07-01T00:00:00", 1820), // 10/Tag
            r("2025-01-01T00:00:00", 5500), // ~20/Tag im 2. Halbjahr
            r("2025-07-01T00:00:00", 7310),
        ]);
        const p = projectBillingPeriod(baseMeter, segments, new Date(2025, 6, 2).getTime())!;
        expect(p.basis).toBe("last-year");
        expect(p.projectedConsumption - p.consumptionSoFar).toBeGreaterThan(3500);
    });
});

describe("Plausibilität", () => {
    const history = [r("2025-01-01", 1000), r("2025-01-11", 1100)]; // 10/Tag

    it("warnt bei niedrigerem Stand", () => {
        expect(checkReading(history, r("2025-01-20", 1050))?.kind).toBe("lower-than-previous");
    });

    it("akzeptiert niedrigeren Stand beim Zählerwechsel", () => {
        expect(checkReading(history, r("2025-01-20", 5, true))).toBeNull();
    });

    it("warnt bei unrealistisch hohem Verbrauch (z. B. Ziffer zu viel)", () => {
        expect(checkReading(history, r("2025-01-21", 11000))?.kind).toBe("unusually-high");
    });

    it("warnt auch bei kurzem Abstand (zweimal am selben Tag)", () => {
        const sameDay = [r("2025-01-01T08:00:00", 1000), r("2025-01-11T08:00:00", 1100), r("2025-01-21T08:00:00", 1200)];
        expect(checkReading(sameDay, r("2025-01-21T08:05:00", 12000))?.kind).toBe("unusually-high");
        expect(checkReading(sameDay, r("2025-01-21T18:00:00", 1205))).toBeNull();
    });

    it("warnt ohne Verbrauchsmuster bei einer Ziffer zu viel", () => {
        expect(checkReading([r("2025-01-01", 2180)], r("2025-01-02", 21800))?.kind).toBe("big-jump");
        expect(checkReading([r("2025-01-01", 2180)], r("2025-01-02", 2195))).toBeNull();
    });

    it("lehnt Datum in der Zukunft ab", () => {
        expect(checkReading(history, r(new Date(Date.now() + 2 * DAY_MS).toISOString(), 1200))?.kind).toBe("future-date");
    });

    it("lässt normale Werte durch", () => {
        expect(checkReading(history, r("2025-01-21", 1205))).toBeNull();
    });
});

describe("CSV-Export", () => {
    it("erzeugt Excel-taugliches CSV mit Verbrauch", async () => {
        const { readingsToCsv } = await import("@/lib/meter/export");
        const reading = (date: string, value: number, extra = {}) => ({
            id: date, meterId: "m", value, date: new Date(date).toISOString(), isReplacement: false, source: "app", createdAt: "", updatedAt: "", ...extra,
        });
        const csv = readingsToCsv([reading("2025-02-01T09:00:00", 12400.25), reading("2025-01-01T09:00:00", 12345.5)], "kWh");
        const lines = csv.replace("﻿", "").split("\r\n");
        expect(lines[0]).toBe("Datum;Uhrzeit;Stand (kWh);Verbrauch seit vorheriger (kWh);Zählerwechsel;Quelle;Hinweis");
        expect(lines[1]).toBe("1.1.2025;09:00;12345,5;;;App;");
        expect(lines[2]).toBe("1.2.2025;09:00;12400,25;54,75;;App;");
    });
});

describe("Vorschau beim Ablesen", () => {
    it("zeigt Verbrauch und Tagesschnitt seit der vorherigen Ablesung", async () => {
        const { previewReading } = await import("@/lib/meter/stats");
        const p = previewReading([r("2025-01-01T08:00:00", 1000), r("2025-01-11T08:00:00", 1100)], r("2025-01-21T08:00:00", 1250))!;
        expect(p.consumption).toBe(150);
        expect(p.days).toBeCloseTo(10);
        expect(p.perDay).toBeCloseTo(15);
    });

    it("rechnet bei einem Datum in der Vergangenheit gegen die Ablesung davor", async () => {
        const { previewReading } = await import("@/lib/meter/stats");
        const p = previewReading([r("2025-01-01T08:00:00", 1000), r("2025-01-11T08:00:00", 1100)], r("2025-01-06T08:00:00", 1040))!;
        expect(p.previous.value).toBe(1000);
        expect(p.consumption).toBe(40);
    });

    it("kein Tagesschnitt bei weniger als einem Tag, keine Vorschau beim Zählerwechsel", async () => {
        const { previewReading } = await import("@/lib/meter/stats");
        expect(previewReading([r("2025-01-01T08:00:00", 1000)], r("2025-01-01T09:00:00", 1001))?.perDay).toBeNull();
        expect(previewReading([r("2025-01-01T08:00:00", 1000)], r("2025-01-05T08:00:00", 0, true))).toBeNull();
    });
});
