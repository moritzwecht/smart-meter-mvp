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
    conversionMissing,
    currentPeriodStart,
    DAY_MS,
    dailyAverage,
    GAS_PROFILE,
    monthlyConsumption,
    previewReading,
    priceLooksTooHigh,
    projectBillingPeriod,
    sortReadings,
    timestampForDay,
    toSegments,
} from "@/lib/meter/stats";
import { meterFieldsFromForm, emptyMeterForm } from "@/components/dashboard/meter/MeterForm";
import { readingsToCsv } from "@/lib/meter/export";
import { parseDecimal, roundReading } from "@/lib/numbers";

const r = (date: string, value: number, isReplacement = false) => ({ date: new Date(date).toISOString(), value, isReplacement });
const total = (segments: { consumption: number }[]) => segments.reduce((s, x) => s + x.consumption, 0);

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
        expect(dailyAverage(segments)).toBeCloseTo(200 / 30); // 1000 → 1100 → 1200 in 30 Tagen
    });
});

describe("B2: Gas mit Preis pro kWh braucht Zustandszahl und Brennwert", () => {
    it("ohne Umrechnungswerte keine (um Faktor ~10 zu niedrige) Kosten", () => {
        const incomplete = { ...gas, zNumber: null, calorificValue: null };
        // Entweder Kosten nicht berechenbar – oder ein realistischer Faktor, nicht 1
        expect(canComputeCost(incomplete) && billingFactor(incomplete) === 1).toBe(false);
    });

    it("ohne Zustandszahl/Brennwert darf der Zähler angelegt werden – Kosten erscheinen aber erst mit beiden Werten (UX U4)", () => {
        const form = { ...emptyMeterForm("GAS"), pricePerUnit: "0,11", priceUnit: "kwh" };
        const res = meterFieldsFromForm(form);
        if ("error" in res) throw new Error(res.error);
        expect(canComputeCost(res.fields)).toBe(false);
        expect(billingFactor(res.fields)).toBe(1);
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

describe("B4: Monatsbalken im laufenden Monat (Daten; die Beschriftung prüft tests/dom)", () => {
    it("liefert für einen angebrochenen Monat den erfassten Anteil", () => {
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

// Nach der Gegenprüfung ergänzt ----------------------------------------------------------

describe("B1: Grenzfälle der Ausreißer-Erkennung", () => {
    it("Ziffer zu viel, danach nur EINE richtige Ablesung: der Tippfehler fliegt raus, nicht der richtige Wert", () => {
        const { segments, ignored } = toSegments([r("2025-01-01", 1000), r("2025-01-11", 10500), r("2025-01-21", 1100)]);
        expect(ignored.map((x) => x.value)).toEqual([10500]);
        expect(total(segments)).toBe(100);
    });

    it("Tippfehler in der ersten Ablesung", () => {
        const { segments, ignored } = toSegments([r("2025-01-01", 10000), r("2025-01-11", 1100), r("2025-01-21", 1200)]);
        expect(ignored.map((x) => x.value)).toEqual([10000]);
        expect(total(segments)).toBe(100);
    });

    it("nicht markierter Zählerwechsel: beide Zählerhistorien bleiben, nur der Sprung zählt nicht", () => {
        const xs = [r("2025-01-01", 5000), r("2025-02-01", 5300), r("2025-03-01", 5600), r("2025-03-15", 10), r("2025-04-01", 200), r("2025-05-01", 500), r("2025-06-01", 800)];
        const { segments, ignored, drops } = toSegments(xs);
        expect(ignored).toEqual([]);
        expect(drops.map((x) => x.value)).toEqual([10]);
        expect(total(segments)).toBe(600 + 790);
    });

    it("nur zwei Stände mit Rückgang: nicht entscheidbar → kein Verbrauch, aber gemeldet", () => {
        const { segments, anomalies } = toSegments([r("2025-01-01", 1000), r("2025-01-11", 900)]);
        expect(segments).toEqual([]);
        expect(anomalies).toBe(1);
    });

    it("Delle mitten im Verlauf: gleichmäßigere Lösung gewinnt", () => {
        // 10/Tag; 1090 statt 1190 getippt
        const { ignored, segments } = toSegments([r("2025-01-01", 1000), r("2025-01-11", 1100), r("2025-01-20", 1090), r("2025-01-31", 1300)]);
        expect(ignored.map((x) => x.value)).toEqual([1090]);
        expect(total(segments)).toBe(300);
    });

    it("Zählerwechsel mitten drin wird nicht als Ausreißer behandelt", () => {
        const { segments, anomalies } = toSegments([r("2025-01-01", 900), r("2025-01-11", 1000), r("2025-01-11T13:00:00", 5, true), r("2025-01-21", 105)]);
        expect(anomalies).toBe(0);
        expect(segments.map((x) => x.consumption)).toEqual([100, 100]);
    });

    it("Warnung beim Eintragen erkennt einen Ausreißer im vorherigen Stand", () => {
        const issue = checkReading([r("2025-01-01", 1000), r("2025-01-11", 10500)], r("2025-01-21", 1100), Date.parse("2025-03-01"));
        expect(issue).toEqual({ kind: "lower-than-previous", previous: 10500, previousSuspicious: true });
        // 950 liegt auch unter dem Stand davor → eher Zählerwechsel oder Tippfehler im neuen Wert
        const plain = checkReading([r("2025-01-01", 1000), r("2025-01-11", 1100)], r("2025-01-21", 950), Date.parse("2025-03-01"));
        expect(plain).toEqual({ kind: "lower-than-previous", previous: 1100, previousSuspicious: false });
    });
});

describe("N1: gleicher Zeitpunkt", () => {
    const prev = r("2025-03-01T12:00:00", 9800);
    const oldFinal = r("2025-03-10T12:00:00", 10000);
    const newStart = r("2025-03-10T12:00:00", 0, true);
    const next = r("2025-03-20T12:00:00", 100);

    it("Zählerwechsel am selben Zeitpunkt: unabhängig von der Reihenfolge 300", () => {
        for (const order of [[prev, oldFinal, newStart, next], [prev, newStart, oldFinal, next], [next, newStart, oldFinal, prev]]) {
            const { segments, anomalies } = toSegments(order);
            expect({ anomalies, total: total(segments) }).toEqual({ anomalies: 0, total: 300 });
        }
        expect(sortReadings([newStart, oldFinal]).map((x) => x.isReplacement)).toEqual([false, true]);
    });

    it("zwei Stände am selben Zeitpunkt: der zuletzt eingetragene gilt", () => {
        const a = { ...r("2025-03-10T12:00:00", 1000), createdAt: "2025-03-11T08:00:00.000Z" };
        const b = { ...r("2025-03-10T12:00:00", 1050), createdAt: "2025-03-11T09:00:00.000Z" };
        const p = r("2025-03-01T12:00:00", 900);
        const n = r("2025-03-20T12:00:00", 1100);
        for (const order of [[p, a, b, n], [p, b, a, n]]) {
            const { segments } = toSegments(order);
            expect(total(segments)).toBe(200);
            expect(segments[0].consumption).toBe(150); // 900 → 1050 (b ist neuer)
        }
    });

    it("weitere Einträge für denselben vergangenen Tag kommen eine Minute später", () => {
        const existing = [r("2025-03-10T12:00:00", 10000)];
        const now = Date.parse("2025-04-01T10:00:00");
        const first = timestampForDay("2025-03-11", existing, now);
        expect(new Date(first).getHours()).toBe(12);
        const second = timestampForDay("2025-03-10", existing, now);
        expect(Date.parse(second) - Date.parse(existing[0].date)).toBe(60_000);
        expect(timestampForDay("2025-04-01", existing, now)).toBe(new Date(now).toISOString());
    });

    it("CSV: Endstand des alten Zählers vor dem Startstand des neuen", () => {
        const row = (x: ReturnType<typeof r>, id: string) => ({ ...x, id, meterId: "m", source: "app", createdAt: "", updatedAt: "", deletedAt: null });
        const csv = readingsToCsv([row(newStart, "b"), row(oldFinal, "a")], "m³");
        const lines = csv.replace("\uFEFF", "").split("\r\n");
        expect(lines[1]).toContain(";10000;");
        expect(lines[2]).toContain(";0;;ja;");
    });
});

describe("B2: Erweiterungen", () => {
    it("Gas ist mit €/kWh voreingestellt", () => {
        expect(emptyMeterForm("GAS").priceUnit).toBe("kwh");
        expect(emptyMeterForm("ELECTRICITY").priceUnit).toBeNull();
    });

    it("„m3“ wird als m³ erkannt und umgerechnet", () => {
        const res = meterFieldsFromForm({ ...emptyMeterForm("GAS"), unit: "m3", pricePerUnit: "0,11", zNumber: "0,95", calorificValue: "11,2" });
        if ("error" in res) throw new Error(res.error);
        expect(res.fields.unit).toBe("m³");
        expect(billingFactor(res.fields)).toBeCloseTo(10.64);
    });

    it("Zustandszahl 0 oder unplausible Werte werden abgelehnt", () => {
        const base = { ...emptyMeterForm("GAS"), pricePerUnit: "0,11", calorificValue: "11,2" };
        expect("error" in meterFieldsFromForm({ ...base, zNumber: "0" })).toBe(true);
        expect("error" in meterFieldsFromForm({ ...base, zNumber: "95" })).toBe(true);
        expect("error" in meterFieldsFromForm({ ...base, zNumber: "0,95", calorificValue: "112" })).toBe(true);
    });

    it("Liter mit Preis pro kWh: keine Kosten statt Faktor 1", () => {
        const liters = { ...gas, unit: "l" };
        expect(conversionMissing(liters)).toBe(true);
        expect(canComputeCost(liters)).toBe(false);
        // Im Formular gibt es die Wahl €/kWh bei Litern gar nicht
        const res = meterFieldsFromForm({ ...emptyMeterForm("GAS"), unit: "l", pricePerUnit: "0,11" });
        if ("error" in res) throw new Error(res.error);
        expect(res.fields.priceUnit).toBeNull();
    });

    it("Preis pro m³ ohne Umrechnung und Gas in kWh bleiben berechenbar", () => {
        expect(canComputeCost({ ...gas, priceUnit: null, zNumber: null, calorificValue: null })).toBe(true);
        expect(canComputeCost({ ...gas, unit: "kWh", zNumber: null, calorificValue: null })).toBe(true);
        expect(billingFactor({ ...gas, unit: "kWh" })).toBe(1);
    });
});

describe("B3: Jahresprofil Gas", () => {
    it("Profil ergibt 100 %, Sommer-Beispiel landet bei ≈ 2.190 m³ und gilt als unsicher", () => {
        expect(GAS_PROFILE.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
        const { segments } = toSegments([r("2025-06-01T12:00:00", 0), r("2025-08-31T12:00:00", 182)]);
        const p = projectBillingPeriod(gas, segments, new Date(2025, 8, 1).getTime())!;
        expect(p.projectedConsumption).toBeGreaterThan(2100);
        expect(p.projectedConsumption).toBeLessThan(2300);
        expect(p.basis).toBe("profile");
        expect(p.uncertain).toBe(true);
        expect(p.balance!).toBeLessThan(-1000); // Nachzahlung statt Guthaben
    });

    it("Winter-Ablesungen werden nicht zu hoch hochgerechnet", () => {
        // Dezember–Februar: 10 m³/Tag
        const { segments } = toSegments([r("2024-12-01T12:00:00", 0), r("2025-03-01T12:00:00", 900)]);
        const p = projectBillingPeriod(gas, segments, new Date(2025, 2, 2).getTime())!;
        expect(p.projectedConsumption).toBeLessThan(900 * 365 / 90 * 0.7);
        expect(p.uncertain).toBe(false);
    });

    it("mit Vorjahr gilt weiter das Vorjahr", () => {
        const { segments } = toSegments([r("2024-01-01T00:00:00", 0), r("2025-01-01T00:00:00", 2000), r("2025-03-01T00:00:00", 2900)]);
        const p = projectBillingPeriod(gas, segments, new Date(2025, 2, 2).getTime())!;
        expect(p.basis).toBe("last-year");
        expect(p.uncertain).toBe(false);
    });
});

describe("B7: Vorschau zeigt die spätere Ablesung", () => {
    it("liefert die nächste Ablesung mit", () => {
        const p = previewReading([r("2025-01-01", 1000), r("2025-02-01", 1100)], r("2025-01-15", 1200))!;
        expect(p.next?.value).toBe(1100);
    });
});

describe("B8: Obergrenzen je Zählerart", () => {
    const now = Date.parse("2026-03-01");
    it("neuer Zähler: Start 150, ein Jahr später 3150 kWh → keine Warnung", () => {
        expect(checkReading([r("2024-01-01", 150)], r("2025-01-01", 3150), now, { type: "ELECTRICITY", unit: "kWh" })).toBeNull();
    });
    it("Wasser: eine Ziffer zu viel in m³ fällt auf", () => {
        expect(checkReading([r("2025-01-01", 123.4)], r("2025-01-11", 1240.5), now, { type: "WATER", unit: "m³" })?.kind).toBe("big-jump");
        expect(checkReading([r("2025-01-01", 123.4)], r("2025-01-11", 124.5), now, { type: "WATER", unit: "m³" })).toBeNull();
    });
    it("eigene Einheit: keine Annahme", () => {
        expect(checkReading([r("2025-01-01", 1)], r("2025-01-02", 100000), now, { type: "ELECTRICITY", unit: "Wh" })).toBeNull();
    });
});

describe("B11: Bearbeiten nutzt dieselbe Prüfung", () => {
    it("Stand zwischen zwei Ablesungen, der über der späteren liegt, wird erkannt", () => {
        const others = [r("2025-01-01", 1000), r("2025-02-01", 1100)];
        expect(checkReading(others, r("2025-01-15", 1150), Date.parse("2025-03-01"))?.kind).toBe("higher-than-next");
    });
});

describe("B12: Ende des Abrechnungsjahres", () => {
    it("29.02. als Beginn: Jahr endet am 28.02. des Folgejahres", () => {
        const { segments } = toSegments([r("2025-01-01", 0), r("2025-06-01", 1510)]);
        const p = projectBillingPeriod({ ...gas, type: "ELECTRICITY", unit: "kWh", priceUnit: null, billingStart: "2024-02-29" }, segments, Date.parse("2025-06-02"))!;
        expect(new Date(p.periodStart).toDateString()).toBe(new Date(2025, 1, 28).toDateString());
        expect(new Date(p.periodEnd).toDateString()).toBe(new Date(2026, 1, 28).toDateString());
        const leap = projectBillingPeriod({ ...gas, type: "ELECTRICITY", unit: "kWh", priceUnit: null, billingStart: "2024-02-29" }, segments, Date.parse("2028-06-02"))!;
        expect(new Date(leap.periodStart).toDateString()).toBe(new Date(2028, 1, 29).toDateString());
    });
});

describe("B9/N6: Zahlen", () => {
    it("rundet wie die Datenbank auf 4 Nachkommastellen", () => {
        expect(roundReading(100.00009)).toBe(100.0001);
        expect(roundReading(100.00004)).toBe(100);
        expect(roundReading(12345.6)).toBe(12345.6);
    });
    it.each(["12.345.6", "1.2.3", "1,2,3", "1.23.456", "1.2.3,4", "1,2.5", "12,345,6.7"])("%s → null", (input) => {
        expect(parseDecimal(input)).toBeNull();
    });
    it.each([
        ["1.234.567,8", 1234567.8],
        ["1,234,567.8", 1234567.8],
        ["-1.234,5", -1234.5],
        ["12.345", 12.345],
    ])("%s → %s", (input, expected) => {
        expect(parseDecimal(input)).toBe(expected);
    });
});

// Nachbesserung nach der unabhängigen Prüfung der Umsetzung -------------------------------

describe("Nachbesserung: Nachbarn bei gleichem Zeitpunkt", () => {
    const now = Date.parse("2025-06-01");
    const prev = r("2025-03-01T12:00:00", 9800);
    const newStart = r("2025-03-10T12:00:00", 0, true);
    const next = r("2025-03-20T12:00:00", 100);

    it("Endstand des alten Zählers bearbeiten, wenn der Zählerwechsel denselben Zeitpunkt hat", () => {
        const edited = r("2025-03-10T12:00:00", 10010);
        expect(checkReading([prev, newStart, next], edited, now)).toBeNull();
        expect(previewReading([prev, newStart, next], edited)?.previous.value).toBe(9800);
    });

    it("ein neuer Zählerwechsel zum selben Zeitpunkt kommt nach dem Endstand", () => {
        const oldFinal = r("2025-03-10T12:00:00", 10000);
        expect(checkReading([prev, oldFinal], r("2025-03-10T12:00:00", 0, true), now)).toBeNull();
    });
});

describe("Nachbesserung: Vergleich mit dem mitgerechneten Stand", () => {
    it("ein erkannter Tippfehler (Delle) ist nicht der Vergleichswert für den nächsten Stand", () => {
        const xs = [r("2025-01-01T12:00", 1000), r("2025-01-11T12:00", 1100), r("2025-01-21T12:00", 1200), r("2025-01-31T12:00", 290)];
        expect(toSegments(xs).ignored.map((x) => x.value)).toEqual([290]);
        const cand = r("2025-02-01T12:00", 1310);
        expect(checkReading(xs, cand, Date.parse("2025-03-01"), { type: "ELECTRICITY", unit: "kWh" })).toBeNull();
        const p = previewReading(xs, cand)!;
        expect([p.previous.value, p.consumption, p.perDay]).toEqual([1200, 110, 10]); // 11 Tage
    });
});

describe("Nachbesserung: Ziffer zu viel nach langer Zeit (B8)", () => {
    const now = Date.parse("2026-03-01");
    const kwh = { type: "ELECTRICITY" as const, unit: "kWh" };
    it("2000 → 50000 nach einem Jahr wird erkannt", () => {
        expect(checkReading([r("2024-01-01", 2000)], r("2025-01-01", 50000), now, kwh)).toMatchObject({ kind: "big-jump", ratio: true });
    });
    it("normaler Jahresverbrauch und kleine Startstände bleiben ohne Warnung", () => {
        expect(checkReading([r("2024-01-01", 2000)], r("2025-01-01", 8000), now, kwh)).toBeNull();
        expect(checkReading([r("2024-01-01", 150)], r("2025-01-01", 3150), now, kwh)).toBeNull();
    });
});

describe("Nachbesserung: Prognose erst ab 14 Tagen", () => {
    it("zwei Ablesungen eine Stunde auseinander ergeben keine (absurde) Jahresprognose", () => {
        const { segments } = toSegments([r("2025-07-10T10:00", 1000), r("2025-07-10T11:00", 1000.5)]);
        expect(projectBillingPeriod(gas, segments, Date.parse("2025-07-10T12:00"))).toBeNull();
    });
    it("ab 14 Tagen gibt es eine Prognose", () => {
        const { segments } = toSegments([r("2025-07-01T10:00", 1000), r("2025-07-15T10:00", 1028)]);
        expect(projectBillingPeriod(gas, segments, Date.parse("2025-07-16T12:00"))).not.toBeNull();
    });
});

describe("Nachbesserung: nächste freie Minute", () => {
    const now = Date.parse("2025-04-01T10:00:00");
    it("zwischen Werten im Viertelstundentakt landet ein Nachtrag bei 12:00 bzw. der nächsten freien Minute", () => {
        const api = Array.from({ length: 96 }, (_, i) => r(new Date(2025, 2, 10, 0, i * 15).toISOString(), 1000 + i));
        const t = new Date(timestampForDay("2025-03-10", api, now));
        expect([t.getHours(), t.getMinutes()]).toEqual([12, 1]);
    });
    it("eine Ablesung um 23:59 stört nicht", () => {
        const t = new Date(timestampForDay("2025-03-10", [r(new Date(2025, 2, 10, 23, 59).toISOString(), 1)], now));
        expect([t.getHours(), t.getMinutes()]).toEqual([12, 0]);
    });
});

// UX-Prüfung (docs/UX_ZAEHLER.md) – Rechenteile ------------------------------------------

describe("UX U1: Preis in Cent statt Euro", () => {
    it.each([
        [{ type: "ELECTRICITY", unit: "kWh", priceUnit: null, pricePerUnit: 32 }, 100],
        [{ type: "ELECTRICITY", unit: "kWh", priceUnit: null, pricePerUnit: 0.32 }, null],
        [{ type: "GAS", unit: "m³", priceUnit: "kwh", pricePerUnit: 11.5 }, 100],
        [{ type: "GAS", unit: "m³", priceUnit: null, pricePerUnit: 1.2 }, null],
        [{ type: "GAS", unit: "m³", priceUnit: null, pricePerUnit: 120 }, 100],
        [{ type: "WATER", unit: "m³", priceUnit: null, pricePerUnit: 4.5 }, null],
        [{ type: "WATER", unit: "m³", priceUnit: null, pricePerUnit: 450 }, 100],
        [{ type: "WATER", unit: "l", priceUnit: null, pricePerUnit: 4.5 }, 1000],
        [{ type: "WATER", unit: "Wh", priceUnit: null, pricePerUnit: 99 }, null],
    ] as const)("%o → %s", (meter, expected) => {
        expect(priceLooksTooHigh(meter)).toBe(expected);
    });
});

describe("UX U6: Durchschnitt erst ab einem Tag", () => {
    it("zwei Ablesungen Minuten auseinander ergeben keinen Tageswert – und verderben die Tippfehlerprüfung nicht", () => {
        const xs = [r("2025-01-01T08:00:00", 1000), r("2025-01-01T08:10:00", 1084)];
        const { segments } = toSegments(xs);
        expect(dailyAverage(segments)).toBeNull();
        // ohne „üblichen“ Wert greift die Obergrenze pro Tag: eine Ziffer zu viel fällt weiter auf
        expect(checkReading(xs, r("2025-01-02T08:00:00", 10900), Date.parse("2025-03-01"))?.kind).toBe("big-jump");
    });
});

describe("UX U5: geschätzter Anteil der Prognose", () => {
    it("weist den geschätzten Teil von „bisher“ aus", () => {
        // Abrechnungsjahr ab 01.01., Ablesungen erst ab 01.06.
        const { segments } = toSegments([r("2025-06-01T00:00:00", 0), r("2025-07-01T00:00:00", 300)]);
        const p = projectBillingPeriod({ ...gas, type: "ELECTRICITY", unit: "kWh", priceUnit: null }, segments, Date.parse("2025-07-02"))!;
        expect(p.estimatedSoFar).toBeGreaterThan(1400); // Januar–Mai geschätzt (≈ 151 Tage × 10)
        expect(p.consumptionSoFar - p.estimatedSoFar).toBeCloseTo(300, 0);
        expect(new Date(p.knownUntil).toDateString()).toBe(new Date(2025, 6, 1).toDateString());
    });
});
