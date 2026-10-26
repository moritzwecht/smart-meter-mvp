# Prüfung: Zähler – Berechnungen und Logik

Stand: 26.10.2026 · Umfang: alles, was mit Zählern rechnet oder entscheidet.

| Bereich | Dateien |
| --- | --- |
| Verbrauch, Kosten, Prognose, Plausibilität | `src/lib/meter/stats.ts` |
| Zahlen lesen/formatieren, CSV | `src/lib/numbers.ts`, `src/lib/meter/format.ts`, `src/lib/meter/export.ts` |
| Anzeige | `MeterWidget`, `MeterDetailDialog`, `MeterReadingDialog`, `ConsumptionChart`, `MeterForm` |
| Server | `readings-api.ts` (Home Assistant), `cron.ts` (Erinnerung), `sync/schemas.ts` (Validierung), DB-Spalten |

**Vorgehen:**
1. Code gelesen, jeden Verdacht mit einem Test belegt. Jeder Test beschreibt das **richtige** Verhalten und schlug vor der Korrektur fehl: `tests/unit/meter-audit.test.ts`, `tests/server/api.test.ts`.
2. Eine unabhängige Gegenprüfung hat jeden Befund nachvollzogen, Schweregrade und Lösungsvorschläge bewertet und weitere Fehler gefunden (N1–N6).
3. Danach wurde dieses Dokument berichtigt.
4. Alle Befunde wurden behoben (siehe „Umsetzung“). Die Tests oben laufen jetzt grün, dazu kommen Tests für die neuen Fälle (auch Bearbeiten im Dialog und die API).

## So rechnet die App

- **Verbrauch** entsteht nur zwischen zwei Ablesungen desselben Zählers und wird gleichmäßig auf die Zeit dazwischen verteilt (lineare Interpolation). Daraus ergeben sich Monatswerte, Durchschnitte und Zeiträume, auch wenn nicht genau an Monatsgrenzen abgelesen wurde.
- **Zählerwechsel**: Eine als „Zählerwechsel“ markierte Ablesung beginnt einen neuen Zähler. Der Sprung zum neuen Startstand zählt nicht als Verbrauch.
- **Ø pro Tag (30 Tage)**: die 30 Tage vor der letzten Ablesung. **Ø gesamt**: der gesamte Verbrauch geteilt durch die erfasste Zeit.
- **Kosten** = Verbrauch × Umrechnungsfaktor × Arbeitspreis, dazu die Grundgebühr.
  - Bei Gas mit Preis pro kWh und Zähler in m³ ist der Faktor Zustandszahl × Brennwert.
  - Fehlen Zustandszahl oder Brennwert, zeigt die App keine Kosten, sondern einen Hinweis. Vor der Korrektur wurde stillschweigend mit 1 gerechnet (B2).
- **Prognose fürs Abrechnungsjahr**:
  - Bisheriger Verbrauch: Lücken werden geschätzt.
  - Rest des Jahres: der Verbrauch im gleichen Zeitraum des Vorjahres, wenn dieser zu mindestens 80 % erfasst ist. Sonst eine Hochrechnung aus dem bisherigen Verbrauch – bei Gas nach einem typischen Jahresprofil (B3), bei Strom und Wasser gleichmäßig.
  - Ist weniger als ein Viertel des Jahresverbrauchs gemessen, steht „unsicher“ an der Prognose.
  - Daraus: Kosten inkl. 12 × Grundgebühr, verglichen mit 12 × Abschlag ergibt Guthaben bzw. Nachzahlung.

## Befunde

Schwere: **hoch** = falsche Zahlen, die zu falschen Entscheidungen führen · **mittel** = sichtbar falsch oder irreführend in üblichen Fällen · **niedrig** = Randfälle · **Hinweis** = derzeit nicht erreichbar oder Geschmackssache.

| ID | Schwere | Befund | Gegenprüfung | Status |
| --- | --- | --- | --- | --- |
| B1 | hoch | Ein Tippfehler verfälscht den Verbrauch | bestätigt | behoben |
| B2 | hoch | Gas pro kWh: Kosten können rund zehnmal zu niedrig sein | bestätigt, erweitert | behoben |
| B3 | hoch | Gas-Prognose ohne Vorjahr ignoriert den Winter | bestätigt, von mittel hochgestuft | behoben |
| B4 | mittel | Laufender Monat im Diagramm heißt „Schätzung“ | bestätigt | behoben |
| B5 | niedrig | „≈ … € pro Monat“ ohne Grundgebühr | bestätigt, von mittel heruntergestuft | behoben |
| B6 | mittel | „Als Zählerwechsel markieren“ geht nicht | bestätigt | behoben |
| B7 | niedrig | Nachgetragene Stände werden nicht mit späteren verglichen | bestätigt | behoben |
| B8 | niedrig | Fehlwarnung bei neuen Zählern mit kleinem Startwert | bestätigt, Vorschlag verbessert | behoben |
| B9 | niedrig | Mehr als 4 Nachkommastellen: falsches 422 oder doppelte Werte | bestätigt, erweitert | behoben |
| B11 | mittel | Bearbeiten ohne Prüfung, sogar mit Datum in der Zukunft | bestätigt, erweitert | behoben |
| B12 | niedrig | Abrechnungsbeginn 29.02. springt auf den 01.03. | bestätigt | behoben |
| N1 | mittel | Gleicher Zeitpunkt: Zählerwechsel und Tageswerte zufällig falsch | neu gefunden | behoben |
| N2 | mittel | Home Assistant: die 15-Minuten-Regel „wandert“ mit | neu gefunden | behoben |
| N5 | niedrig | Unveränderte Werte aus Home Assistant zählen nicht für die Erinnerung | neu gefunden | behoben |
| N6 | niedrig | „12.345.6“ wird zu 123456 statt abgelehnt | neu gefunden | behoben |
| B10 | Hinweis | Sortierung als Text, geht in N1 auf | bestätigt, abgestuft | mit N1 behoben |

### B1 – Ein Tippfehler verfälscht den Verbrauch (hoch)

Wo: `toSegments` (`stats.ts`), dazu `readings-api.ts`.

Gerechnet wird immer zwischen benachbarten Ablesungen. Ein Rückgang wird übersprungen, der Tippfehler selbst bleibt aber in der Rechnung:

- **Zu niedrig:** 1000 → 900 → 1100 ergibt 200 statt 100, weil der nächste Abschnitt beim falschen Stand beginnt.
- **Zu hoch (eine Ziffer zu viel):** 1000 → 10500 → 1100 → 1200 zählt +9500. Nur der Rückgang 10500 → 1100 fällt weg, spätere Abschnitte zählen normal.
- **Home Assistant:** Liegt so ein zu hoher Stand vor, lehnt die API jeden neuen Wert mit 422 ab, bis der Zähler den falschen Stand erreicht. Bei einer Ziffer zu viel wären das Jahre.

Meist entsteht B1 erst nach einer bestätigten Warnung. Über B7 (Nachtragen) und B11 (Bearbeiten) geht es aber ganz ohne Warnung.

Verworfener Vorschlag: „längste nicht fallende Folge“. Die Gegenprüfung hat zwei Fälle gefunden, in denen er schlechter wäre als heute. Bei [1000, 10500, 1100] würde der richtige Stand verworfen. Bei einem nicht markierten Zählerwechsel würde die ganze kürzere Zählerhistorie wegfallen.

Umgesetzter Vorschlag: Ausreißer **lokal** erkennen. Bei einem Rückgang von a auf b:
- **a ist eine Spitze**, wenn der Stand vor a ≤ b ist (oder a der erste Stand ist). Dann fällt a weg.
- **b ist eine Delle**, wenn a ≤ der Stand nach b ist (oder b der letzte Stand ist). Dann fällt b weg.
- **Beides möglich:** Es gewinnt die Lösung mit dem kleineren Verbrauch im betroffenen Bereich. Ist der gleich, gewinnt die mit dem gleichmäßigeren Verbrauch.
- **Nichts davon passt:** Das ist ein nicht markierter Zählerwechsel. Wie bisher fällt nur dieser eine Abschnitt weg, und die App weist darauf hin.

Die API nimmt einen neuen Wert an, wenn der letzte Stand eine Spitze war.

### B2 – Gas pro kWh: Kosten rund zehnmal zu niedrig (hoch)

Wo: `billingFactor`, `canComputeCost`, `MeterForm`.

1. **Fehlende Werte:** Zustandszahl und Brennwert sind optional. Fehlen sie, rechnet die App mit dem Faktor 1, also m³ × €/kWh. Richtig wären etwa 10.
2. **Voreinstellung:** Für Gas ist „€/m³“ vorausgewählt, obwohl Gastarife praktisch immer in ct/kWh angegeben werden. Wer 0,11 einträgt und die Voreinstellung lässt, rechnet ebenfalls zehnmal zu niedrig.
3. **Eigene Einheit:** Bei Einheiten wie „m3“ oder „l“ wird der Schalter €/kWh angezeigt, die Umrechnungsfelder aber nicht. Der Faktor bleibt 1.
4. **Wert 0:** Das Formular erlaubt 0, der Server verlangt Werte > 0. Die Änderung wird abgelehnt und beim nächsten vollen Abgleich zurückgesetzt.

Folge: Kosten und Prognose sind viel zu niedrig, und die App meldet ein Guthaben statt einer Nachzahlung.

Vorschlag:
- Für neue Gaszähler „€/kWh“ voreinstellen.
- Den Schalter €/kWh nur bei m³ anzeigen; die Eingabe „m3“ wird als m³ erkannt.
- Beide Umrechnungswerte > 0 verlangen.
- Keine Kosten ausweisen, solange die Umrechnung unvollständig ist.
- Einen Hinweis geben, wenn ein Preis „pro m³“ verdächtig nach einem Preis pro kWh aussieht.

### B3 – Gas-Prognose ohne Vorjahr (hoch, betrifft nur das erste Jahr)

Wo: `projectBillingPeriod`.

Ohne Vorjahresdaten wird mit dem flachen Durchschnitt hochgerechnet. Bei Gas fällt im Januar aber etwa sechsmal so viel Verbrauch an wie im Juli.

Beispiel: Ablesungen von Juni bis August, 2 m³ pro Tag.
- Die App rechnet ≈ 730 m³ fürs Jahr hoch und zeigt etwa 400 € Guthaben.
- Realistisch sind ≈ 2.200 m³, denn Juni bis August machen nur gut 8 % des Jahresverbrauchs aus. Das wären etwa 1.300 € Nachzahlung.
- Der Gegenfall: Ablesungen nur im Winter ergeben eine zu hohe Prognose.

Vorschlag: Ein typisches Jahresprofil für Gas verwenden, also Heizung nach Gradtagzahlen plus Warmwasser.

| Jan | Feb | Mär | Apr | Mai | Jun | Jul | Aug | Sep | Okt | Nov | Dez |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 15,6 % | 13,7 % | 12,3 % | 8,6 % | 5,2 % | 3,1 % | 2,6 % | 2,6 % | 3,8 % | 7,6 % | 11,4 % | 13,5 % |

So wird es verwendet:
- Der gemessene Verbrauch wird an diesem Profil skaliert. Genauso werden der Rest des Jahres und Lücken geschätzt.
- Vorjahresdaten haben weiter Vorrang.
- Solange der gemessene Zeitraum weniger als ein Viertel des Jahresverbrauchs abdeckt, kennzeichnet die App die Prognose als **unsicher**. Die Hochrechnung reagiert dann stark auf den Warmwasseranteil: Bei 10–30 % ergeben sich im Beispiel 1.650–3.000 m³.
- Grenze: Haushalte, die Gas nur zum Kochen oder für Warmwasser nutzen, passen nicht zum Profil. Ab dem zweiten Jahr zählt das Vorjahr.

### B4 – „Schätzung“ im Monatsdiagramm (mittel)

Wo: `ConsumptionChart`, auch im `aria-label`.

Bei angebrochenen Monaten steht „(Schätzung, 48 % abgedeckt)“. Der Wert ist aber nur der erfasste Verbrauch. Der Balken des laufenden Monats wirkt dadurch zu klein.

Vorschlag: „erfasst: 48 % des Monats“. Das stimmt auch für vergangene Monate mit Lücke und für den ersten Monat.

### B5 – Monatliche Kosten ohne Grundgebühr (niedrig)

Wo: `MeterDetailDialog` → `Statistics`.

„≈ 106,63 € pro Monat“ enthält nur den Arbeitspreis, der Abschlag deckt aber beides.

Vorschlag: Die Grundgebühr einrechnen und das dazuschreiben. Bei Gas bleibt der Wert jahreszeitabhängig.

### B6 – Zählerwechsel nachträglich markieren (mittel)

Wo: `MeterDetailDialog`.

Der Hinweis „… oder als Zählerwechsel markieren“ lässt sich nicht befolgen: Beim Bearbeiten gibt es nur Stand und Datum. Der Server erlaubt die Änderung schon.

Vorschlag: Beim Bearbeiten ein Häkchen „Zählerwechsel“.

### B7 – Nachtragen in die Vergangenheit (niedrig)

Wo: `checkReading`, `previewReading`, auch die API.

Ein nachgetragener Stand wird nur mit dem Stand **davor** verglichen. Ist er höher als eine **spätere** Ablesung, entsteht ohne Warnung ein Rückgang.

Vorschlag: Auch gegen die nächste Ablesung prüfen und das in der Vorschau anzeigen.

### B8 – Fehlwarnung bei neuen Zählern (niedrig)

Wo: `checkReading`, Fall „big-jump“.

„Mehr als dreimal so hoch“ ignoriert, wie viel Zeit vergangen ist.
- Startstand 5 und 500 kWh nach einem Monat: Fehlwarnung.
- Startstand 150 und 3150 kWh nach einem Jahr: ebenfalls Fehlwarnung.

Vorschlag: Ohne Verbrauchsmuster gegen eine **Tagesrate** prüfen, mit großzügigen Obergrenzen je Typ und Einheit (z. B. Strom 100 kWh/Tag, Gas 30 m³/Tag, Wasser 3 m³/Tag). Eine Ziffer zu viel bleibt erkennbar.

### B9 – Nachkommastellen (niedrig)

Wo: `readings-api.ts`; Datenbank `numeric(16,4)`.

Die Datenbank rundet auf 4 Nachkommastellen.
- **Aufrundung:** `100,00009` wird als `100,0001` gespeichert. Derselbe Wert gilt danach als kleiner, und die API antwortet mit 422.
- **Abrundung:** `100,00004` wird zu `100,0000` und ist danach „nicht gleich“. Mit mehr als 15 Minuten Abstand entstehen dadurch doppelte Einträge.

Vorschlag: Werte vor dem Vergleichen und Speichern einheitlich auf 4 Stellen runden, in der API und in der App.

### B11 – Bearbeiten ohne Prüfung (mittel)

Wo: `ReadingRow` (`MeterDetailDialog`).

Ein bearbeiteter Stand wird ohne Prüfung gespeichert. Auch ein Datum in der Zukunft geht durch.

Folgen:
- Abschnitte reichen in die Zukunft.
- „Ø 30 Tage“ und die Prognose beziehen sich auf die Zukunft.
- Die Erinnerung kommt nie mehr.

Vorschlag: Dieselbe Prüfung wie beim Eintragen, gegen die übrigen Ablesungen, mit Warnung und zweitem Tippen. Ein Datum in der Zukunft wird abgelehnt.

### B12 – 29. Februar (niedrig)

Wo: `currentPeriodStart`, Ende des Abrechnungsjahres.

In Nicht-Schaltjahren wird aus dem 29.02. der 01.03.

Vorschlag: Den Tag auf das Monatsende begrenzen, auch beim Ende des Abrechnungsjahres.

### N1 – Gleicher Zeitpunkt (mittel)

Wo: Sortierung in `stats.ts`, `hooks.ts`, `export.ts`; Zeitpunkt in `MeterReadingDialog`.

Nachgetragene Tage bekommen immer 12:00 Uhr. Bei gleichem Zeitpunkt entscheidet der Zufall über die Reihenfolge.

- **Zählerwechsel:** Wer für einen vergangenen Tag den Endstand des alten und den Startstand des neuen Zählers einträgt, bekommt in etwa der Hälfte der Fälle 0 statt 300 Verbrauch. Dazu kommen „+10000 / −9900“ im Verlauf und die Warnung „als Zählerwechsel markieren“, obwohl markiert ist.
- **Zwei Stände am selben vergangenen Tag:** 150 oder 250 statt 200.

Vorschlag:
- Gleichstände eindeutig sortieren: nach Zeitpunkt, dann normale Ablesung vor Zählerwechsel, dann Eintragungszeitpunkt.
- In der Rechnung zählt bei gleichem Zeitpunkt der zuletzt eingetragene Stand.
- Weitere Einträge für denselben vergangenen Tag bekommen eine Minute später.

### N2 – Home Assistant: die 15-Minuten-Regel wandert mit (mittel)

Wo: `readings-api.ts`.

Beim Aktualisieren wird auch das Datum vorgezogen, und der nächste Wert vergleicht wieder mit diesem neuen Datum.

- Bei Automationen unter 15 Minuten bleibt die gesamte API-Historie **eine einzige Zeile**. 19 Werte im 10-Minuten-Takt ergeben eine Ablesung. Ein Zähler, der nur über die API gefüttert wird, zeigt für immer „Zweite Ablesung nötig“.
- Auch eine Zählerwechsel-Zeile wird überschrieben, ihr Startstand geht verloren.

Vorschlag:
- Nur aktualisieren, solange die Zeile selbst jünger als 15 Minuten ist (Anlagezeitpunkt).
- Zählerwechsel-Zeilen nie aktualisieren.

### N5 – Unveränderte Werte zählen nicht für die Erinnerung (niedrig)

Wo: `readings-api.ts`, `cron.ts`.

Ein unveränderter Wert legt keine Zeile an. Beispiel Wasserzähler im Urlaub: Home Assistant meldet täglich denselben Stand, und trotzdem kommt die Erinnerung.

Vorschlag: Auch einen unveränderten Wert speichern, wenn der letzte Eintrag älter als 20 Stunden ist. Dann steht einmal am Tag ein Eintrag mit 0 Verbrauch im Verlauf.

### N6 – Mehrere Punkte (niedrig)

Wo: `parseDecimal`.

„12.345.6“ ergibt 123456 und „1.2.3“ ergibt 123, statt die Eingabe abzulehnen.

Vorschlag: Tausendertrennzeichen nur in Dreiergruppen akzeptieren, sonst `null`.

### B10 – Sortierung als Text (Hinweis)

Alle Zeitpunkte laufen über `toISOString()` und haben damit immer Millisekunden. Der Fehler ist derzeit nicht erreichbar. Er wird mit N1 behoben.

## Umsetzung

Umgesetzt wie oben vorgeschlagen, mit diesen Details und Abweichungen:

- **B1**:
  - Nur zwei Stände mit Rückgang sind nicht entscheidbar. Dann zählt der Abschnitt nicht, und die App meldet es.
  - Ausreißer und Rückgänge sind im Verlauf markiert („nicht mitgerechnet“ bzw. „Zählerwechsel?“).
  - Liegt ein neuer Stand unter dem vorherigen, aber über dem davor, sagt die Warnung beim Eintragen: Die vorherige Ablesung war vermutlich der Tippfehler.
  - Die API nimmt in diesem Fall wieder Werte an. Ein Sensor-Reset auf 0 bleibt abgelehnt.
- **B2**:
  - Plausible Bereiche: Zustandszahl 0,5–1,5, Brennwert 5–15 kWh/m³. Sonst lehnt das Formular ab.
  - Unter dem Preisfeld erscheint ein Hinweis, wenn der Preis pro m³ unter 0,40 € liegt.
  - Bestehende Gaszähler ohne Umrechnungswerte: Die Statistik zeigt einen Hinweis statt Kosten, und die Einstellungen sind aufgeklappt.
- **B3**:
  - Auch Lücken bei der Vorjahres-Basis werden nach dem Profil geschätzt.
  - Abweichung: „unsicher“ gilt für alle Zählerarten. Zwei Monate Strom auf ein Jahr hochgerechnet sind ebenso unsicher.
- **B5**: „≈ … € pro Monat inkl. Grundgebühr“, mit einem durchschnittlichen Monat von 30,4 Tagen.
- **B8**: Obergrenzen pro Tag, solange es kein Verbrauchsmuster gibt:
  - Strom 150 kWh
  - Gas 40 m³ bzw. 400 kWh
  - Wasser 5 m³ bzw. 5.000 l
  - Eigene Einheiten: keine Grenze
- **B9**: Auch die App rundet beim Speichern auf 4 Nachkommastellen. So ändert sich ein Wert nach dem Abgleich nicht mehr.
- **B11**: Beim Bearbeiten bleibt die Uhrzeit erhalten. Läge sie heute noch in der Zukunft, gilt „jetzt“.
- **N2** – Abweichung vom Vorschlag: feste Viertelstunden (:00, :15, :30, :45) nach dem Datum der Ablesung, statt nach dem Anlagezeitpunkt der Zeile.
  - Das funktioniert auch für nachgetragene Werte mit `date`.
  - Es entstehen höchstens 4 Ablesungen pro Stunde.
- **README**: Das Verhalten der API ist dort jetzt beschrieben.

## Geprüft und korrekt

- **Kosten** gegen Handrechnung: Gas 100 m³ × 0,95 × 11,2 × 0,11 € = 117,04 €. Strom und Wasser haben den Faktor 1.
- **Interpolation über Monatsgrenzen**:
  - Die Abdeckung wird richtig ermittelt.
  - Die Sommerzeit verschiebt keine Monatsgrenze, weil in lokaler Zeit gerechnet wird.
- **Zählerwechsel** mit unterschiedlichen Zeitpunkten: Der Sprung zählt nicht, der neue Zähler rechnet ab seinem Startstand.
- **Prognose mit Vorjahr**:
  - Die Saison wird übernommen, Lücken im laufenden Jahr werden geschätzt.
  - In Schaltjahren überlappt der Zeitraum des Vorjahres um bis zu etwa 18 Stunden mit dem laufenden Jahr. Das ist vernachlässigbar.
- **Guthaben/Nachzahlung**: Vorzeichen, 12 Abschläge und 12 × Grundgebühr stimmen.
- **Plausibilität beim Eintragen**:
  - Ein Datum in der Zukunft wird abgelehnt.
  - Ein niedrigerer Stand ohne Zählerwechsel führt zu einer Warnung.
  - Eine Ziffer zu viel wird auch bei zwei Ablesungen am selben Tag erkannt.
- **Live-Vorschau beim Ablesen**: Sie rechnet mit dem Stand davor, auch beim Nachtragen.
- **Verlauf**: Die Differenz zur vorherigen Ablesung stimmt, auch beim Zählerwechsel und wenn nur die letzten 10 Einträge angezeigt werden.
- **CSV**: Dezimalkomma, keine Tausenderpunkte, Differenz pro Zeile, auch bei negativen Werten. Zählerwechsel ohne Differenz.
- **Erinnerung**:
  - Sie kommt am eingestellten Tag nach deutscher Zeit (Tag 1–28, der Job läuft um 07:00 UTC).
  - Sie kommt nur, wenn ein Zähler seit 5 Tagen keinen neuen Stand hat.
- **Home-Assistant-API**:
  - Ein kleinerer Wert wird abgelehnt, außer er ist als Zählerwechsel markiert.
  - Ein Datum in der Zukunft wird abgelehnt.
- **Zahlen lesen**: „12.345,6“, „12345,6“, „12345.6“, „0,32 €“ und „1,234,567“ werden richtig gelesen.

## Hinweise und Grenzen (bewusst nicht geändert)

- **„12.345“ in der Eingabe** gilt als 12,345, nicht als 12345. Die Schreibweise ist mehrdeutig, und bei Preisen wie „0.325“ ist die Dezimal-Lesart richtig. Die Live-Vorschau beim Ablesen und die Warnung vor zu niedrigen Ständen machen den Fehler sofort sichtbar.
- **12 Abschläge pro Jahr**: Manche Versorger berechnen 11 Abschläge. Wer das hat, trägt den Abschlag so ein, dass die Jahressumme stimmt (Jahresbetrag ÷ 12).
- **Strom und Wasser**: Die Prognose ohne Vorjahr nutzt den flachen Durchschnitt. Die Schwankung übers Jahr ist dort klein.
- **Ø 30 Tage** bezieht sich auf die 30 Tage vor der letzten Ablesung, nicht vor heute.
- **Ausreißer-Erkennung (B1)** erkennt einzelne Tippfehler.
  - Zwei Tippfehler direkt hintereinander sehen aus wie ein nicht markierter Zählerwechsel. Dann zählt wie bisher nur der Sprung nicht, und die App weist darauf hin.
  - Liegt die neueste Ablesung unter den beiden vorherigen Ständen, zählt sie zunächst nicht. Erst die nächste Ablesung zeigt, ob es ein Zählerwechsel war.
- **Zwei Stände mit exakt gleichem Zeitpunkt**: Es zählt der zuletzt eingetragene.
