# Prüfung: Zähler – Berechnungen und Logik

Stand: 26.10.2026 · Umfang: alles, was mit Zählern rechnet oder entscheidet.

| Bereich | Dateien |
| --- | --- |
| Verbrauch, Kosten, Prognose, Plausibilität | `src/lib/meter/stats.ts` |
| Zahlen lesen/formatieren, CSV | `src/lib/numbers.ts`, `src/lib/meter/format.ts`, `src/lib/meter/export.ts` |
| Anzeige | `MeterWidget`, `MeterDetailDialog`, `MeterReadingDialog`, `ConsumptionChart`, `MeterForm` |
| Server | `readings-api.ts` (Home Assistant), `cron.ts` (Erinnerung), `sync/schemas.ts` (Validierung), DB-Spalten |

Belegt wird jeder Befund durch einen Test, der das **richtige** Verhalten beschreibt und vor der Korrektur fehlschlug: `tests/unit/meter-audit.test.ts`, `tests/server/api.test.ts` (B9).

## So rechnet die App

- **Verbrauch** entsteht nur zwischen zwei Ablesungen desselben Zählers und wird gleichmäßig auf die Zeit dazwischen verteilt (lineare Interpolation). Daraus ergeben sich Monatswerte, Durchschnitte und Zeiträume, auch wenn nicht genau an Monatsgrenzen abgelesen wurde.
- **Zählerwechsel**: Eine als „Zählerwechsel“ markierte Ablesung beginnt einen neuen Zähler. Der Sprung zum neuen (meist niedrigen) Stand zählt nicht als Verbrauch.
- **Ø pro Tag (30 Tage)**: die 30 Tage vor der letzten Ablesung. **Ø gesamt**: der gesamte Verbrauch geteilt durch die erfasste Zeit.
- **Kosten** = Verbrauch × Umrechnungsfaktor × Arbeitspreis, dazu die Grundgebühr. Der Faktor ist bei Gas mit Preis pro kWh Zustandszahl × Brennwert, sonst 1.
- **Prognose fürs Abrechnungsjahr**:
  - Bisheriger Verbrauch: Lücken werden mit dem Durchschnitt gefüllt.
  - Rest des Jahres: der Verbrauch im gleichen Zeitraum des Vorjahres, wenn dieser zu mindestens 80 % erfasst ist. Sonst der Durchschnitt.
  - Daraus: Kosten inkl. 12 × Grundgebühr, verglichen mit 12 × Abschlag ergibt Guthaben bzw. Nachzahlung.

## Befunde

Schwere: **hoch** = falsche Zahlen, die zu falschen Entscheidungen führen · **mittel** = sichtbar falsch oder irreführend in üblichen Fällen · **niedrig** = Randfälle.

| ID | Schwere | Befund |
| --- | --- | --- |
| B1 | hoch | Ein Tippfehler verfälscht den Verbrauch |
| B2 | hoch | Gas mit Preis pro kWh ohne Zustandszahl/Brennwert: Kosten rund zehnmal zu niedrig |
| B3 | mittel | Gas-Prognose ohne Vorjahr ignoriert den Winter |
| B4 | mittel | Laufender Monat im Diagramm heißt „Schätzung“, ist aber nur der bisherige Anteil |
| B5 | mittel | „≈ … € pro Monat“ ohne Grundgebühr – passt nicht zum Abschlag |
| B6 | mittel | Hinweis „als Zählerwechsel markieren“ – dafür gibt es keine Möglichkeit |
| B7 | niedrig | Nachgetragene Stände werden nur mit dem vorherigen, nicht mit dem späteren verglichen |
| B8 | niedrig | Fehlwarnung „mehr als dreimal so hoch“ bei neuen Zählern mit kleinem Startwert |
| B9 | niedrig | Werte mit mehr als 4 Nachkommastellen: Home Assistant bekommt fälschlich „kleiner als letzter Stand“ |
| B10 | niedrig | Ablesungen werden als Text statt nach Zeitpunkt sortiert |
| B11 | niedrig | Beim Bearbeiten einer Ablesung gibt es keine Plausibilitätsprüfung |
| B12 | niedrig | Abrechnungsbeginn 29.02. springt in Nicht-Schaltjahren auf den 1.03. |

### B1 – Ein Tippfehler verfälscht den Verbrauch (hoch)

Wo: `toSegments` in `stats.ts`.

Ein Stand, der niedriger ist als der vorherige, wird übersprungen. Der **nächste** Abschnitt beginnt aber bei genau diesem falschen Stand.

- **Zu niedrig:** 1000 → 900 (Tippfehler) → 1100 ergibt 200 Verbrauch statt 100.
- **Zu hoch (eine Ziffer zu viel):** 1000 → 10500 → 1100 → 1200 zählt +9500. Alle späteren Stände gelten dann als „niedriger als vorher“ und fallen aus der Rechnung, bis der Zähler 10500 erreicht – also über Jahre.

Folgen: Durchschnitt, Monatswerte, Prognose und Guthaben sind falsch.

Vorschlag: Ausreißer als Ganzes erkennen. Pro Zählerperiode, also zwischen zwei Zählerwechseln, die längste nicht fallende Folge von Ständen behalten; alles andere gilt als Ausreißer. Bei Gleichstand bleiben die früheren Stände, damit eher der neue, auffällige Stand herausfällt.

### B2 – Gas pro kWh ohne Umrechnungswerte (hoch)

Wo: `billingFactor`, `meterFieldsFromForm`.

Die Felder sind optional. Fehlen Zustandszahl oder Brennwert, nimmt die App den Faktor 1 und rechnet m³ × €/kWh. Der richtige Faktor liegt bei etwa 10. Kosten und Prognose sind dann rund zehnmal zu niedrig, und die App meldet ein großes Guthaben, wo eine Nachzahlung droht.

Vorschlag:
- Im Formular beide Werte verlangen, wenn der Preis pro kWh gilt.
- In der Rechnung keine Kosten ausweisen, solange ein Wert fehlt.

### B3 – Gas-Prognose ohne Vorjahr (mittel)

Wo: `projectBillingPeriod`.

Ohne Vorjahresdaten wird der Rest des Jahres mit dem flachen Durchschnitt hochgerechnet. Bei Gas schwankt der Verbrauch übers Jahr aber stark: Im Januar ist er etwa sechsmal so hoch wie im Juli.

Beispiel: Ablesungen nur von Juni bis August mit 2 m³ pro Tag ergeben eine Prognose von etwa 730 m³ fürs Jahr. Realistisch sind ungefähr 2.200 m³, denn Juni bis August machen typischerweise nur gut 8 % des Jahresverbrauchs aus. Die App zeigt dann ein Guthaben statt einer deutlichen Nachzahlung.

Vorschlag: Für Gas ein typisches Jahresprofil verwenden (Monatsanteile ähnlich dem Standardlastprofil). Der gemessene Verbrauch wird an diesem Profil skaliert, und genau so werden der Rest des Jahres und Lücken geschätzt. Liegen Vorjahresdaten vor, haben sie wie bisher Vorrang.

### B4 – „Schätzung“ im Monatsdiagramm (mittel)

Wo: `ConsumptionChart`.

Bei angebrochenen Monaten steht „(Schätzung, 48 % abgedeckt)“. Der Wert ist aber keine Schätzung für den ganzen Monat, sondern nur der Verbrauch bis zur letzten Ablesung. Der Balken des laufenden Monats wirkt dadurch zu klein.

Vorschlag: Ehrlich beschriften, etwa „bisher · 48 % des Monats erfasst“.

### B5 – Monatliche Kosten ohne Grundgebühr (mittel)

Wo: `MeterDetailDialog` → `Statistics`.

„≈ 106,63 € pro Monat“ enthält nur den Arbeitspreis. Wer das mit seinem Abschlag von 120 € vergleicht, unterschätzt die Kosten um die Grundgebühr.

Vorschlag: Die Grundgebühr einrechnen und das in der Beschriftung sagen.

### B6 – Zählerwechsel nachträglich markieren (mittel)

Wo: `MeterDetailDialog`.

Der Warnhinweis bei niedrigeren Ständen sagt: „… oder als Zählerwechsel markieren“. Beim Bearbeiten einer Ablesung lassen sich aber nur Stand und Datum ändern.

Vorschlag: Beim Bearbeiten ein Häkchen „Zählerwechsel“ anbieten.

### B7 – Nachtragen in die Vergangenheit (niedrig)

Wo: `checkReading`.

Ein nachgetragener Stand wird nur mit dem Stand **davor** verglichen. Ist er höher als eine **spätere** Ablesung (etwa 1200 zwischen 1000 und 1100), entsteht ein Rücksprung, und es kommt keine Warnung.

Vorschlag: Auch gegen die nächste Ablesung prüfen.

### B8 – Fehlwarnung bei neuen Zählern (niedrig)

Wo: `checkReading`, Fall „big-jump“.

Ein neuer Zähler mit Startstand 5 und 500 kWh nach einem Monat löst „mehr als dreimal so hoch“ aus.

Vorschlag: Nur bei Startwerten ab 100 und erst ab dem Fünffachen warnen. Eine Ziffer zu viel (Faktor 10) wird damit weiterhin erkannt.

### B9 – Nachkommastellen (niedrig)

Wo: `readings-api.ts`; Datenbank `numeric(16,4)`.

Die Datenbank rundet auf 4 Nachkommastellen. Ein Sensorwert `100,00009` wird als `100,0001` gespeichert. Kommt derselbe Wert noch einmal, gilt er als kleiner als der letzte Stand, und die API antwortet mit 422.

Vorschlag: Werte vor dem Vergleichen und Speichern auf 4 Nachkommastellen runden, in der API und in der App.

### B10 – Sortierung als Text (niedrig)

Wo: `toSegments`, `checkReading`, `previewReading`.

Ablesungen werden über den ISO-Text sortiert. Bei gleicher Sekunde mit und ohne Millisekunden (`…08:00:00Z` gegen `…08:00:00.500Z`) stimmt die Reihenfolge nicht. In der Praxis selten, aber unnötig.

Vorschlag: Nach dem Zeitpunkt sortieren.

### B11 – Bearbeiten ohne Prüfung (niedrig)

Wo: `ReadingRow`.

Ein bearbeiteter Stand wird ohne jede Plausibilitätsprüfung gespeichert, anders als beim Eintragen.

Vorschlag: Dieselbe Prüfung wie beim Eintragen, gegen die übrigen Ablesungen, mit Warnung und zweitem Tippen zum Bestätigen.

### B12 – 29. Februar (niedrig)

Wo: `currentPeriodStart`.

In Nicht-Schaltjahren wird aus dem 29.02. der 01.03.

Vorschlag: Auf den letzten Tag des Monats begrenzen.

## Geprüft und korrekt

- **Kosten** gegen Handrechnung: Gas 100 m³ × 0,95 × 11,2 × 0,11 € = 117,04 €. Strom und Wasser haben den Faktor 1.
- **Interpolation über Monatsgrenzen**:
  - Die Abdeckung wird richtig ermittelt.
  - Die Sommerzeit verschiebt keine Monatsgrenze, weil in lokaler Zeit gerechnet wird.
- **Zählerwechsel**: Der Sprung zählt nicht, der neue Zähler rechnet ab seinem Startstand.
- **Prognose bei konstantem Verbrauch und mit Vorjahr**: Die Saison des Vorjahres wird übernommen. Lücken im laufenden Jahr werden geschätzt, der Zeitraum des Vorjahres überschneidet sich nicht mit dem laufenden Jahr.
- **Guthaben/Nachzahlung**: Vorzeichen, 12 Abschläge und 12 × Grundgebühr stimmen.
- **Plausibilität**:
  - Ein Datum in der Zukunft wird abgelehnt.
  - Ein niedrigerer Stand ohne Zählerwechsel führt zu einer Warnung.
  - Eine Ziffer zu viel wird auch bei zwei Ablesungen am selben Tag erkannt.
- **Live-Vorschau beim Ablesen**: Sie rechnet mit dem Stand davor, auch beim Nachtragen.
- **Verlauf**: Die Differenz zur vorherigen Ablesung stimmt, auch beim Zählerwechsel und wenn nur die letzten 10 Einträge angezeigt werden.
- **CSV**: Dezimalkomma, keine Tausenderpunkte, Differenz pro Zeile, Zählerwechsel ohne Differenz.
- **Erinnerung**:
  - Sie kommt am eingestellten Tag nach deutscher Zeit.
  - Sie kommt nur, wenn ein Zähler seit 5 Tagen keinen Stand hat. Automatische Werte aus Home Assistant zählen dabei mit.
- **Home-Assistant-API**:
  - Gleicher Wert wird nicht doppelt gespeichert.
  - Ein kleinerer Wert wird abgelehnt, außer er ist als Zählerwechsel markiert.
  - Werte innerhalb von 15 Minuten aktualisieren die letzte API-Ablesung.
  - Ein Datum in der Zukunft wird abgelehnt.
- **Zahlen lesen**: „12.345,6“, „12345,6“, „12345.6“, „0,32 €“ und „1,234,567“ werden richtig gelesen. Ungültige Eingaben ergeben `null` statt einer falschen Zahl.

## Hinweise und Grenzen (bewusst nicht geändert)

- **„12.345“ in der Eingabe** gilt als 12,345, nicht als 12345. Die Schreibweise ist mehrdeutig, und bei Preisen wie „0.325“ ist die Dezimal-Lesart richtig. Die Live-Vorschau beim Ablesen und die Warnung vor zu niedrigen Ständen machen den Fehler sofort sichtbar.
- **12 Abschläge pro Jahr**: Manche Versorger berechnen 11 Abschläge. Wer das hat, trägt den Abschlag so ein, dass die Jahressumme stimmt (Jahresbetrag ÷ 12).
- **Strom und Wasser**: Die Prognose ohne Vorjahr nutzt den flachen Durchschnitt. Die Schwankung übers Jahr ist dort klein.
- **Ø 30 Tage** bezieht sich auf die 30 Tage vor der letzten Ablesung, nicht vor heute.
