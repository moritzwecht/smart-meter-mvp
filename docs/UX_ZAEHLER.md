# UX-Prüfung: Zähler

Stand: 26.10.2026 · Umfang: alles, was man von Zählern sieht und bedient. Dazu gehören:
- die Karte in der Übersicht
- „Ablesung eintragen“
- die Details mit Statistik, Diagramm, Verlauf und Einstellungen
- „Neuer Zähler“
- der Bereich „Home Assistant & API“ im Profil

**Vorgehen:**
1. Zwei unabhängige Prüfungen auf dem Handy (390 px, hell und dunkel), mit realistischen Testdaten und automatischen Messungen:
   - **A – Aufgaben:** zehn typische Abläufe aus Sicht von Moritz und von einer Mitbewohnerin ohne Technikbezug.
   - **B – Expertenbewertung:** die 10 Heuristiken von Nielsen, Konsistenz und Texte, Barrierefreiheit nach WCAG 2.1 AA (axe-core, Kontraste, Tippflächen, Screenreader), Leer- und Randzustände.
2. Beide Prüfungen abgeglichen und zu einer Liste zusammengeführt (unten). Die Spalte „Quelle“ zeigt, wer den Punkt gefunden hat.
3. Die Liste wurde unabhängig gegengeprüft, dann umgesetzt und erneut geprüft.

Schwere: **hoch** = führt zu falschen Zahlen oder Entscheidungen oder blockiert · **mittel** = verwirrt im Alltag · **niedrig** = Feinschliff.

## Liste

| ID | Schwere | Quelle | Problem | Entscheidung |
| --- | --- | --- | --- | --- |
| U1 | hoch | A, B | Preis in Cent eingetippt („32“) wird als 32 €/kWh gespeichert, und die Karte zeigt „−107.734 € Nachzahlung“. | umsetzen |
| U2 | hoch | A, B | Zwei Zähler gleichen Typs (z. B. Haushalt und Wärmepumpe) sind nicht zu unterscheiden – auf der Karte, in Dialogen, im Profil und für Screenreader. | umsetzen |
| U3 | hoch | A, B | Profil: Der neue Token macht die Seite 523 px breit, „Kopieren“ liegt außerhalb des Bildschirms. | umsetzen |
| U4 | hoch | A, B | „Neuer Zähler“: Ein Fehler im *optionalen* Kostenteil verhindert das Anlegen, und die Meldung steht außerhalb des sichtbaren Bereichs. | umsetzen |
| U5 | hoch | A, B | Kennzahlen der Prognose missverständlich: „≈ −157 € Nachzahlung“ (doppelt negativ), „Prognose Jahr“ (welches?), „bisher“ enthält Geschätztes, ohne es zu sagen, Cent-Genauigkeit bei Schätzungen, „% der Abschläge“ ohne Bezug. | umsetzen |
| U6 | hoch | A | Ø/Tag und € pro Monat werden aus wenigen Minuten hochgerechnet (z. B. „12.113 m³/Tag“). | umsetzen |
| U7 | hoch | A | Zählerwechsel: Werden Endstand und Startstand in falscher Reihenfolge eingetragen, entstehen still falsche Zahlen. Der Haken erklärt nicht, dass der Endstand des alten Zählers dazugehört. | umsetzen |
| U8 | hoch | B | Kontrast unter WCAG AA: Warnungen (amber 3,1:1), Erfolgsmeldungen, negatives Delta, „Liter/Tag“ (2,7:1), Pin-Symbol (1,7:1), inaktiver Umschalter. | umsetzen |
| U9 | mittel | A, B | Auffälligkeiten (Tippfehler, Zählerwechsel): Die Karte zeigt nichts. In den Details steht ein langer Absatz unter den Zahlen, ohne direkte Aktion. | umsetzen |
| U10 | mittel | A, B | Warnung bei Tippfehlern erst nach „Speichern“, die Vorschau bleibt grau. „sonst sind es ca. 4,11.“ ohne Einheit. „7.010“ (mit Tausenderpunkt gemeint) ergibt eine unverständliche Warnung. | umsetzen |
| U11 | mittel | A, B | Einstellungen: Änderungen gehen beim Schließen still verloren, „Speichern“ steht versteckt unter dem Verlauf. Die Einheit lässt sich trotz vorhandener Ablesungen ändern. „Zähler löschen“ steht prominent neben der Hauptaktion. | umsetzen |
| U12 | mittel | A, B | Ablesung im Verlauf bearbeiten: Felder ohne Beschriftung und Einheit, nur ✓/✕ (32 px). Nach einer Warnung bleibt der Knopf gleich, Enter speichert nicht. | umsetzen |
| U13 | mittel | A, B | Nach dem Speichern einer Ablesung keine Rückmeldung und kein Rückgängig. | umsetzen |
| U14 | mittel | A, B | Einheiten in Großbuchstaben: „M³“ (liest sich wie Mega), „KWH“. | umsetzen |
| U15 | mittel | B | Tippflächen unter 44 px: Aufklapp-Überschriften 16 px, „CSV exportieren“, ✓/✕, Speichern, Schließen, Checkbox. | umsetzen |
| U16 | mittel | B | Screenreader: „Eintragen“ dreimal ohne Bezug, „Ø“ wird als „Durchmesser“ gelesen. Verlaufszeilen ohne Trenner und Einheit, „Ablesung bearbeiten“ ohne Datum, Abschnittstitel keine Überschriften. | umsetzen |
| U17 | mittel | A, B | Gas: Rechnung und Abschlag rechnen in kWh, die App zeigt nur m³. | umsetzen |
| U18 | mittel | A, B | Home Assistant: Das Verhalten der API wird nicht erklärt (Viertelstunde, unveränderte und kleinere Werte, Zählerwechsel). Das Beispiel nutzt veraltete Syntax, fängt „unavailable“ nicht ab und hat keinen Kopieren-Knopf. Die IDs sind ohne Namen. | umsetzen |
| U19 | mittel | A, B | Diagramm: Der laufende Monat ist ausgewählt und dadurch voll gefärbt, er wirkt wie ein ganzer Monat. „erfasst: 77 % des Monats“ ist sperrig, eine Legende fehlt. | umsetzen |
| U20 | niedrig | A | Beim Nachtragen steht oben „Letzter Stand“, die Vorschau rechnet aber mit einem anderen Stand. | umsetzen |
| U21 | niedrig | A | Liegt die letzte Ablesung Monate zurück, wirkt der Ø trotzdem aktuell. | umsetzen |
| U22 | niedrig | A, B | Erste Ablesung: Der Zählerwechsel-Haken erscheint schon, die Texte für 0 und 1 Ablesung sind gleich, der leere Zähler-Tab erklärt nichts. | umsetzen |
| U23 | niedrig | A, B | Toast verdeckt Inhalte im geöffneten Sheet (Speichern, Lösch-Dialog). | umsetzen |
| U24 | niedrig | A | CSV: Differenzen über Tippfehler hinweg, keine Spalte „Hinweis“. | umsetzen |
| U25 | niedrig | B | Zahlenformate uneinheitlich („4,4“ neben „4,08“, Delta ohne Einheit, Liter nicht aus gerundetem Wert). | umsetzen |
| U26 | niedrig | B | Fokusrahmen am Hauptknopf im Dark Mode unsichtbar (weiß auf weiß). | umsetzen |
| U27 | niedrig | A, B | Wichtige Aussagen in 9–10 px Versalien. | teilweise (Statuszeilen ≥ 12 px, normal geschrieben; Labels bleiben) |
| U28 | niedrig | B | Bei 320 px Breite wird das Datum im Ablesedialog abgeschnitten. | umsetzen |
| U29 | niedrig | A, B | „Neuer Zähler“: „Erstellen“ statt „Zähler anlegen“, Abrechnungsbeginn ohne Erklärung, Platzhalter „0,00“ sehen aus wie Werte. | umsetzen |

**Bewusst nicht umgesetzt (Geschmackssache oder zu groß für den Nutzen):**
- Budget-Balken zweifarbig statt Verlauf – der Text wird klarer (U5), der Balken bleibt.
- Hinweis „schwarze Ziffern vor dem Komma“ für Gas.
- Kachel „Vorjahr gleicher Zeitraum“ statt „Ø gesamt“.
- Löschen per Rückgängig statt Bestätigung.
- Einheiten je Zählertyp fest vorgeben – eigene Einheiten sollen möglich bleiben.
- Nach dem Markieren eines Zählerwechsels auf einen fehlenden Endstand hinweisen – mit dem neuen Ablauf (U7) entsteht dieser Fall kaum noch.

## Funktioniert gut (beide Prüfungen)

- Live-Vorschau beim Tippen (Verbrauch, Tage, pro Tag, Kosten) und die Prüfung beim Nachtragen gegen spätere Ablesungen
- Zweistufige Warnung „Trotzdem speichern“ statt harter Sperre; ein Datum in der Zukunft wird hart abgelehnt
- Kennzeichnung im Verlauf (durchgestrichen, „Zählerwechsel?“, eigenes Symbol)
- Nach dem Anlegen geht es direkt ins Ablesen; Kosten sind optional und eingeklappt; Erklärung der Gas-Umrechnung
- Dialoge mit Fokusfalle, Esc und Fokus-Rückgabe; Diagramm per Tastatur und Screenreader bedienbar; Dark Mode ohne Kontrastfehler
- Löschbestätigungen nennen konkret, was gelöscht wird
