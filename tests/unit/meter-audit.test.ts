/**
 * Prüfung der Zähler-Logik (siehe docs/PRUEFUNG_ZAEHLER.md).
 * Jeder Test beschreibt das *richtige* Verhalten – schlägt er fehl, ist der Befund belegt.
 */
import { describe, expect, it } from "vitest";
import {
    billingFactor,
    canComputeCost,
    checkReading,
    consumptionCost,
    currentPeriodStart,
    DAY_MS,
    dailyAverage,
    monthlyConsumption,
    projectBillingPeriod,
    toSegments,
} from "@/lib/meter/stats";
import { meterFieldsFromForm, emptyMeterForm } from "@/components/dashboard/meter/MeterForm";

const r = (date: string, value: number, isReplacement = false) => ({ date: new Date(date).toISOString(), value, isReplacement });

const gas = {
    type: "GAS" as const,
    unit: "m³",
    pricePerUnit: 0.11,
    priceUnit: "kwh",
    zNumber: 0.95,
    calorificValue: 11.2,
    basicFee: 15,
    monthlyPayment: 120,
    billingStart: "2025-01-01",
};

describe("B1: ein Tippfehler darf den Verbrauch nicht verfälschen", () => {
    it("zu niedriger Stand dazwischen: Verbrauch bleibt 100 (nicht 200)", () => {
        // richtig wäre z. B. 1050 gewesen, getippt wurde 900
        const { segments, anomalies } = toSegments([r("2025-01-01", 1000), r("2025-01-11", 900), r("2025-01-21", 1100)]);
        expect(anomalies).toBe(1);
        expect(segments.reduce((s, x) => s + x.consumption, 0)).toBe(100);
    });

    it("zu hoher Stand dazwischen (Ziffer zu viel): Ausreißer fliegt raus, spätere Stände zählen", () => {
        const { segments, anomalies } = toSegments([r("2025-01-01", 1000), r("2025-01-11", 10500), r("2025-01-21", 1100), r("2025-01-31", 1200)]);
        expect(anomalies).toBe(1);
        expect(segments.reduce((s, x) => s + x.consumption, 0)).toBe(200);
        expect(dailyAverage(segments)).toBeCloseTo(10);
    });
});

describe("B2: Gas mit Preis pro kWh braucht Zustandszahl und Brennwert", () => {
    it("ohne Umrechnungswerte keine (um Faktor ~10 zu niedrige) Kosten", () => {
        const incomplete = { ...gas, zNumber: null, calorificValue: null };
        // Entweder Kosten nicht berechenbar – oder ein realistischer Faktor, nicht 1
        expect(canComputeCost(incomplete) && billingFactor(incomplete) === 1).toBe(false);
    });

    it("das Formular verlangt beide Werte, wenn der Preis pro kWh gilt", () => {
        const form = { ...emptyMeterForm("GAS"), pricePerUnit: "0,11", priceUnit: "kwh" };
        expect("error" in meterFieldsFromForm(form)).toBe(true);
    });
});

describe("B3: Gas-Prognose ohne Vorjahr berücksichtigt den Winter", () => {
    it("Ablesungen nur im Sommer: Prognose deutlich über dem Sommer-Schnitt × 365", () => {
        // Juni–August: 2 m³/Tag (nur Warmwasser/Kochen)
        const { segments } = toSegments([r("2025-06-01T12:00:00", 0), r("2025-08-31T12:00:00", 182)]);
        const p = projectBillingPeriod(gas, segments, new Date(2025, 8, 1).getTime())!;
        const naive = 2 * 365;
        expect(p.projectedConsumption).toBeGreaterThan(naive * 2);
    });
});

describe("B4: Monatsbalken im laufenden Monat", () => {
    it("liefert für einen angebrochenen Monat den erfassten Anteil – die Anzeige darf ihn nicht 'Schätzung' nennen", () => {
        const { segments } = toSegments([r("2025-01-01T00:00:00", 0), r("2025-01-16T00:00:00", 150)]);
        const [jan] = monthlyConsumption(segments);
        expect(jan.consumption).toBeCloseTo(150);
        expect(jan.coverage).toBeCloseTo(15 / 31, 2);
    });
});

describe("B7: Plausibilität beim Nachtragen in die Vergangenheit", () => {
    it("warnt, wenn ein nachgetragener Stand höher ist als eine spätere Ablesung", () => {
        const history = [r("2025-01-01", 1000), r("2025-02-01", 1100)];
        expect(checkReading(history, r("2025-01-15", 1200), Date.parse("2025-03-01"))).not.toBeNull();
    });
});

describe("B8: keine Fehlwarnung bei neuen Zählern mit kleinem Startwert", () => {
    it("5 → 500 kWh nach einem Monat ist plausibel", () => {
        expect(checkReading([r("2025-01-01", 5)], r("2025-02-01", 500), Date.parse("2025-03-01"))).toBeNull();
    });
    it("aber 2180 → 21800 (Ziffer zu viel) wird weiter erkannt", () => {
        expect(checkReading([r("2025-01-01", 2180)], r("2025-01-02", 21800), Date.parse("2025-03-01"))).not.toBeNull();
    });
});

describe("B10: Reihenfolge der Ablesungen", () => {
    it("sortiert nach Zeitpunkt, nicht nach Text (z. B. mit und ohne Millisekunden)", () => {
        const { segments } = toSegments([
            { date: "2025-01-01T08:00:00.500Z", value: 101, isReplacement: false },
            { date: "2025-01-01T08:00:00Z", value: 100, isReplacement: false },
            { date: "2025-01-02T08:00:00Z", value: 110, isReplacement: false },
        ]);
        expect(segments[0].consumption).toBe(1);
    });
});

describe("B12: Abrechnungsbeginn am 29. Februar", () => {
    it("springt nicht auf den 1. März", () => {
        const start = new Date(currentPeriodStart("2024-02-29", Date.parse("2025-06-01")));
        expect([start.getMonth(), start.getDate()]).toEqual([1, 28]);
    });
});

describe("Kontrolle: korrekte Rechnungen (müssen grün sein)", () => {
    it("Gas: 100 m³ × 0,95 × 11,2 kWh/m³ × 0,11 €/kWh = 117,04 €", () => {
        expect(consumptionCost(gas, 100)).toBeCloseTo(117.04, 2);
    });
    it("Prognose über ein ganzes Jahr mit konstantem Verbrauch", () => {
        const { segments } = toSegments([r("2025-01-01T00:00:00", 0), r("2025-07-01T00:00:00", 1810)]);
        const p = projectBillingPeriod({ ...gas, type: "ELECTRICITY", unit: "kWh", priceUnit: null, zNumber: null, calorificValue: null, pricePerUnit: 0.3, basicFee: 10, monthlyPayment: 100 }, segments, new Date(2025, 6, 2).getTime())!;
        expect(p.projectedConsumption).toBeCloseTo(3650, -1);
        expect(p.balance).toBeCloseTo(1200 - (3650 * 0.3 + 120), -1);
    });
    it("Zählerwechsel: kein negativer Verbrauch", () => {
        const { segments, anomalies } = toSegments([r("2025-01-01", 9900), r("2025-01-11", 10000), r("2025-01-12", 0, true), r("2025-01-22", 100)]);
        expect(anomalies).toBe(0);
        expect(segments.map((s) => s.consumption)).toEqual([100, 100]);
        expect(DAY_MS).toBe(86_400_000);
    });
});
