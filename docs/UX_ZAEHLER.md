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
3. Eine dritte, unabhängige Prüfung hat die Liste gegengeprüft (siehe „Gegenprüfung“): gegen Code, Belege und beide Originalberichte. Ergebnisse:
   - Alle 29 Punkte sind bestätigt; U8 ist auf mittel abgestuft, U25 nur teilweise.
   - Unterpunkte, die beim Zusammenführen verloren gegangen waren, sind ergänzt.
   - Vier Konflikte sind geklärt.
4. Danach umgesetzt und erneut unabhängig geprüft.

Schwere: **hoch** = führt zu falschen Zahlen oder Entscheidungen oder blockiert · **mittel** = verwirrt im Alltag · **niedrig** = Feinschliff.

## Liste

| ID | Schwere | Quelle | Problem | Entscheidung |
| --- | --- | --- | --- | --- |
| U1 | hoch | A, B | Preis in Cent eingetippt („32“) wird als 32 €/kWh gespeichert, und die Karte zeigt „−107.734 € Nachzahlung“. | umsetzen |
| U2 | hoch | A, B | Zwei Zähler gleichen Typs (z. B. Haushalt und Wärmepumpe) sind nicht zu unterscheiden – auf der Karte, in Dialogen, im Profil und für Screenreader. | umsetzen |
| U3 | hoch | A, B | Profil: Der neue Token macht die Seite 523 px breit, „Kopieren“ liegt außerhalb des Bildschirms. | umsetzen |
| U4 | hoch | A, B | „Neuer Zähler“: Ein Fehler im *optionalen* Kostenteil verhindert das Anlegen, und die Meldung steht außerhalb des sichtbaren Bereichs. | umsetzen |
| U5 | hoch | A, B | Kennzahlen der Prognose missverständlich: „≈ −157 € Nachzahlung“ (doppelt negativ), „Prognose Jahr“ (welches?), „bisher“ enthält Geschätztes, ohne es zu sagen, Cent-Genauigkeit bei Schätzungen, „% der Abschläge“ ohne Bezug. Dazu: „Ø (30 Tage)“ auch bei 5 Tagen Daten und bis zur letzten Ablesung statt heute; „Kosten (Prognose)“ ohne Zeitraum; „bei 150,00 € Abschlag“ ohne „pro Monat“; „Rest anhand des Durchschnitts“ ist Fachsprache, „unsicher“ unerklärt; das Ergebnis steht in der letzten Kachel; ohne Abrechnungsbeginn gilt still der 01.01. Der Balken hat kein `aria-valuetext`, Vorzeichen sind uneinheitlich (− und -). | umsetzen |
| U6 | hoch | A | Ø/Tag und € pro Monat werden aus wenigen Minuten hochgerechnet (z. B. „12.113 m³/Tag“). | umsetzen |
| U7 | hoch | A | Zählerwechsel: Werden Endstand und Startstand in falscher Reihenfolge eingetragen, entstehen still falsche Zahlen, und die Reihenfolge lässt sich im Verlauf nicht korrigieren. Der Haken erklärt nicht, dass der Endstand des alten Zählers dazugehört, und mit Haken verschwindet die Vorschau. | umsetzen: bei gesetztem Haken zwei Felder (Endstand alt, optional; Startstand neu), gleicher Zeitpunkt |
| U8 | mittel | B | Kontrast unter WCAG AA: Warnungen (amber 3,1:1), Erfolgsmeldungen, negatives Delta, „Liter/Tag“ (2,7:1), Pin-Symbol (1,7:1), inaktiver Umschalter. | umsetzen |
| U9 | mittel | A, B | Auffälligkeiten (Tippfehler, Zählerwechsel): Die Karte zeigt nichts. In den Details steht ein langer Absatz unter den Zahlen, ohne direkte Aktion. | umsetzen: Aktion „Als Zählerwechsel markieren“ bietet den Endstand des alten Zählers mit an |
| U10 | mittel | A, B | Warnung bei Tippfehlern erst nach „Speichern“, die Vorschau bleibt grau. „sonst sind es ca. 4,11.“ ohne Einheit. „7.010“ (mit Tausenderpunkt gemeint) ergibt eine unverständliche Warnung. | umsetzen |
| U11 | mittel | A, B | Einstellungen: Änderungen gehen beim Schließen still verloren, „Speichern“ steht versteckt unter dem Verlauf. Die Einheit lässt sich trotz vorhandener Ablesungen ändern. „Zähler löschen“ steht prominent neben der Hauptaktion, die Bestätigung nennt weder Zähler noch Zahl der Ablesungen. | umsetzen: eigene Ansicht; Einheit/Typ nicht sperren, sondern bestätigen lassen (falsch gewählte Einheit ist der typische Korrekturgrund) |
| U12 | mittel | A, B | Ablesung im Verlauf bearbeiten: Felder ohne Beschriftung und Einheit, nur ✓/✕ (32 px). Nach einer Warnung bleibt der Knopf gleich, Enter speichert nicht, keine Live-Vorschau; der Zählerwechsel-Haken heißt anders als beim Ablesen. | umsetzen |
| U13 | mittel | A, B | Nach dem Speichern einer Ablesung keine Rückmeldung und kein Rückgängig. | umsetzen |
| U14 | mittel | A, B | Einheiten in Großbuchstaben: „M³“ (liest sich wie Mega), „KWH“. | umsetzen |
| U15 | mittel | B | Tippflächen unter 44 px: Aufklapp-Überschriften 16 px, „CSV exportieren“, „Alle anzeigen“, ✓/✕, Speichern, Preiseinheit, Einheit „l“, Checkbox; im Profil Token löschen, Zähler-ID, „Beispiel ausblenden“. | umsetzen |
| U16 | mittel | B | Screenreader: „Eintragen“ und „Statistik & Einstellungen“ dreimal ohne Bezug, „Ø“ wird als „Durchmesser“ gelesen, Kacheln als ein Textblock. Verlaufszeilen ohne Trenner und Einheit, „Ablesung bearbeiten/löschen“ ohne Datum, Abschnittstitel keine Überschriften, leerer Zähler doppelt gelesen. | umsetzen |
| U17 | mittel | A, B | Gas: Rechnung und Abschlag rechnen in kWh, die App zeigt nur m³. | umsetzen |
| U18 | mittel | A, B | Home Assistant: Das Verhalten der API wird nicht erklärt (Viertelstunde, unveränderte und kleinere Werte, Zählerwechsel, Einheit muss stimmen). Das Beispiel nutzt veraltete Syntax, fängt „unavailable“ nicht ab, nimmt immer den ersten Zähler und kollidiert mit `automation: !include automations.yaml`. `<pre>` ist per Tastatur nicht scrollbar, kein Kopieren-Knopf. Die IDs sind ohne Namen und ohne aria-label. | umsetzen |
| U19 | mittel | A, B | Diagramm: Der laufende Monat ist ausgewählt und dadurch voll gefärbt, er wirkt wie ein ganzer Monat. „erfasst: 77 % des Monats“ ist sperrig, eine Legende fehlt. | umsetzen |
| U20 | niedrig | A | Beim Nachtragen steht oben „Letzter Stand“, die Vorschau rechnet aber mit einem anderen Stand. | umsetzen |
| U21 | niedrig | A | Liegt die letzte Ablesung Monate zurück, wirkt der Ø trotzdem aktuell. | umsetzen |
| U22 | niedrig | A, B | Erste Ablesung: Der Zählerwechsel-Haken erscheint schon, die Texte für 0 und 1 Ablesung sind gleich, der leere Zähler-Tab erklärt nichts. | umsetzen |
| U23 | niedrig | A, B | Toast verdeckt Inhalte im geöffneten Sheet (Speichern, Lösch-Dialog). | umsetzen |
| U24 | niedrig | A | CSV: Differenzen über Tippfehler hinweg, keine Spalte „Hinweis“. | umsetzen |
| U25 | niedrig | B | Zahlenformate uneinheitlich („4,4“ neben „4,08“, Delta ohne Einheit, 3 Nachkommastellen in der Vorschau). | umsetzen (Liter bleiben genau) |
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
- Monatsbeschriftung mit Jahr und eine Skala im Diagramm – der ausgewählte Monat nennt das Jahr bereits.
- Rückmeldung nach dem CSV-Export – Teilen bzw. Download zeigt das System selbst.

**Nach der Gegenprüfung geändert:** Den Hinweis auf einen fehlenden Endstand nach dem Markieren eines Zählerwechsels hatten wir zunächst ausgeschlossen. Die Gegenprüfung zeigte: Die neue Aktion aus U9 erzeugt genau diesen Fall. Deshalb bietet die Aktion den Endstand gleich mit an (wie U7).

## Gegenprüfung: geklärte Konflikte

- **U4 und die Rechenprüfung (B2):**
  - Kein Konflikt. Die eigentliche Absicherung ist, dass ohne Umrechnung keine Kosten erscheinen. Die Sperre im Formular war zusätzliche Vorsicht.
  - Ein Zähler darf deshalb ohne Zustandszahl und Brennwert angelegt werden; ein Hinweis erklärt, dass Kosten erst danach erscheinen.
  - Unplausible Werte sperren weiter: Der Fehler steht dann über dem Knopf, und der Fokus springt aufs Feld.
- **U2 und der Server:**
  - Namen ohne Datenbank-Migration über die vorhandene Spalte `name`. Leer heißt Standardname des Typs (des mitgeschickten oder, falls keiner kommt, des gespeicherten).
  - Der Server übernimmt den Namen nur, wenn er mitgeschickt wird. Bisher setzte er den Namen bei jeder Typangabe auf den Typ zurück.
  - So überschreiben auch ältere App-Versionen, die beim Speichern der Einstellungen den Typ mitschicken, keinen eigenen Namen.
- **U11:** Einheit und Typ nicht sperren, sondern bestätigen lassen – sonst bliebe bei einer falsch gewählten Einheit nur Löschen.
- **U9 und der fehlende Endstand:** Die Aktion bietet den Endstand mit an (siehe oben).

## Funktioniert gut (beide Prüfungen)

- Live-Vorschau beim Tippen (Verbrauch, Tage, pro Tag, Kosten) und die Prüfung beim Nachtragen gegen spätere Ablesungen
- Zweistufige Warnung „Trotzdem speichern“ statt harter Sperre; ein Datum in der Zukunft wird hart abgelehnt
- Kennzeichnung im Verlauf (durchgestrichen, „Zählerwechsel?“, eigenes Symbol)
- Nach dem Anlegen geht es direkt ins Ablesen; Kosten sind optional und eingeklappt; Erklärung der Gas-Umrechnung
- Dialoge mit Fokusfalle, Esc und Fokus-Rückgabe; Diagramm per Tastatur und Screenreader bedienbar; Dark Mode weitgehend ohne Kontrastfehler (Ausnahmen: Pin-Symbol, Fokusrahmen)
- Die Bestätigung beim Löschen einer Ablesung nennt Stand und Datum

## Umsetzung

| ID | Umgesetzt |
| --- | --- |
| U1 | Hinweis unter dem Preisfeld ab 1 €/kWh, 5 €/m³ Gas, 15 €/m³ Wasser bzw. 0,05 €/l, mit Knopf „Auf 0,32 € ändern“ (÷ 100, bei Litern ÷ 1000). Gespeicherte zu hohe Preise zeigen in den Details einen Hinweis „Preis prüfen“. Platzhalter „z. B. 0,32“, Beschriftung „Arbeitspreis“ mit „In Euro, brutto – wie auf deiner Rechnung“. |
| U2 | Feld „Name (optional)“. Der Name erscheint auf der Karte, in Dialogtiteln, beim Anheften, im Profil, in der Push-Erinnerung und im CSV-Dateinamen. Der Server übernimmt ihn nur, wenn er mitgeschickt wird (ohne Migration). |
| U3 | `Alert` bricht lange Inhalte um (`min-w-0`). Der Token steht in einer eigenen Zeile, darunter „Token kopieren“ über die volle Breite. |
| U4 | Anlegen ohne Zustandszahl/Brennwert erlaubt, mit Hinweis. Fehler stehen über dem Knopf, das Feld wird markiert und bekommt den Fokus. |
| U5 | Ergebnis zuerst („Voraussichtliche Nachzahlung ≈ 157 €“ mit „passend wären ≈ 163 €“). Die Kacheln heißen:<br>– „Ø pro Tag (letzte N Tage) · bis …“<br>– „Ø pro Tag seit …“, nur wenn länger als 30 Tage gemessen<br>– „Bisher (seit …) · bis … · davon ≈ … geschätzt“<br>– „Prognose bis …“ mit verständlicher Basis<br>– „Kosten Abrechnungsjahr (geschätzt)“<br>Dazu: Schätzungen in ganzen Euro, „grobe Schätzung“ statt „unsicher“. Die Karte zeigt „Prognose: 109 % der Abschläge“ und „≈ 157 € Nachzahlung“ ohne Minus. Der Balken hat `aria-valuetext`, Vorzeichen überall mit echtem Minus. |
| U6 | Ø und € pro Monat erst ab einem Tag gemessener Zeit, mit erklärendem Text; das repariert auch die Tippfehlerprüfung. |
| U7 | Mit Haken „Zählerwechsel: neuer Zähler eingebaut“ erscheinen „Endstand alter Zähler (empfohlen)“ mit eigener Vorschau und „Startstand neuer Zähler“. Beide werden zum selben Zeitpunkt in einem Schritt gespeichert, die Sortierung stellt den Endstand davor. |
| U8 | Warn-, Erfolgs- und Fehlertexte in den dunkleren Tönen (amber-800, emerald-800, red-700). Pin-Symbol und Umschalter kräftiger; „Liter/Tag“ ohne Transparenz. |
| U9 | Hinweise oben in den Details, je Fall eine Zeile mit Knopf („Als Zählerwechsel markieren“ öffnet die Ablesung mit Haken und Feld für den Endstand, „Korrigieren“ öffnet sie zum Bearbeiten). Auf der Karte erscheint „N Ablesungen prüfen“. |
| U10 | Die Vorschau prüft live und färbt sich bei jedem Problem sofort. Die Warnung nennt Einheit und erwarteten Stand („Erwartet etwa 7.054 m³. Eine Ziffer zu viel oder das Komma verrutscht?“). Bei „7.010“ kommt der Hinweis auf Tausenderpunkte. |
| U11 | Einstellungen als eigene Ansicht über das Zahnrad, mit „Einstellungen speichern“ im Fuß. Beim Schließen oder Zurück mit offenen Änderungen fragt die App „Änderungen verwerfen?“. Einheit oder Typ ändern fragt nach („Die 24 Ablesungen bleiben unverändert und gelten danach als m³ …“). „Zähler löschen“ steht als Textknopf am Ende, die Bestätigung nennt Zähler und Zahl der Ablesungen. |
| U12 | Bearbeiten als Formular: Beschriftungen, Einheit im Feld, Live-Vorschau, Enter speichert, Knöpfe „Abbrechen“ und „Speichern“ bzw. „Trotzdem speichern“, gleicher Haken-Text wie beim Ablesen. Ein Datum in der Zukunft wird mit eigener Meldung abgelehnt (statt Browser-Blase). |
| U13 | Toast „Gespeichert: 7.024,2 m³ (+9,5 m³ seit 24.10.2026)“ mit „Rückgängig“ (6 s); beim Zählerwechsel entfernt Rückgängig beide Einträge. |
| U14 | Einheiten nie in Großbuchstaben. |
| U15 | Aufklapp-Köpfe, Textknöpfe, Umschalter, Einheiten, Checkboxen (mit Beschriftung), Schließen, Profil-Knöpfe und die Hauptknöpfe der Zählerdialoge mindestens 44 px. Ursache bei den Hauptknöpfen: `.btn` steht in `globals.css` außerhalb von `@layer` und überschreibt `py-…`; dort jetzt `min-h-…`. |
| U16 | Knöpfe mit Zählerbezug („Gas: Ablesung eintragen“), „Ø“ mit „Durchschnitt“ für Screenreader, Kacheln als Liste von Begriffen (`dl`), Verlaufszeilen mit Trennern und „Verbrauch seit vorher“, „Ablesung vom … bearbeiten/löschen“, Abschnittstitel als Überschriften, Karte als benannter Bereich. |
| U17 | In „Bisher“ und „Prognose“ zusätzlich „≈ … kWh“, wenn die Umrechnung vollständig ist. |
| U18 | Absatz „So speichert die App deine Werte“. REST-Befehl und Automation sind getrennte Blöcke in aktueller Syntax (`triggers`/`actions`), mit Bedingung `is_number`, Auswahl des Zählers, Kopieren-Knopf und per Tastatur scrollbar. IDs mit Namen, Kopier-Symbol und aria-label. |
| U19 | Teilmonate bleiben hell, die Auswahl zeigt ein Rahmen. Text „bisher, bis 24.10.2026“ bzw. „nur teilweise abgelesen“, dazu eine Legende. |
| U20 | Beim Nachtragen „Stand davor“ und „Stand danach“ statt „Letzter Stand“. |
| U21 | Ab 45 Tagen ohne Ablesung erscheint ein Hinweis auf der Karte und in den Details, der Ø wird abgeschwächt. |
| U22 | Haken für den Zählerwechsel erst ab der zweiten Ablesung. Eigene Texte für 0, 1 und 2 Ablesungen (unter einem Tag), Erklärung im leeren Zähler-Tab. |
| U23 | Bei offenem Dialog erscheinen Toasts oben. |
| U24 | CSV mit Spalte „Hinweis“ und Differenzen wie im Verlauf. |
| U25 | Ø-Werte mit fester Nachkommastellenzahl, Delta mit Einheit, Vorschau höchstens eine Nachkommastelle ab 100. |
| U26 | Fokusrahmen für Knöpfe in Grün mit Abstand, in beiden Modi sichtbar. |
| U27 | Statuszeilen der Karte und Hinweise ≥ 12 px in normaler Schreibweise; kleine Versalien nur noch für Abschnittstitel. |
| U28 | Datum und Haken im Ablesedialog unter 360 px untereinander. |
| U29 | „Zähler anlegen“, Erklärung beim Abrechnungsbeginn („Leer = 1. Januar“), Beispiel-Platzhalter („z. B. 120“), Hinweis zu 11 Abschlägen. |

**Tests:**
- Neue Komponententests für:
  - Zählerwechsel mit Endstand und Rückgängig
  - die Aktion aus dem Hinweis
  - Einstellungen (Verwerfen-Rückfrage, Einheit ändern)
  - Bearbeiten (Zukunft, Warnung, Verschieben)
  - Anzeigen (Diagramm, Monatskosten, Umrechnung, Cent-Hinweis, „grobe Schätzung“)
- Unit-Tests für die Cent-Prüfung, Ø ab einem Tag und den geschätzten Anteil.
- Ein Server-Test für die Namen.
- Der Browser-Test mit axe-core prüft jetzt auch:
  - Ablesen mit Warnung und mit Zählerwechsel
  - Bearbeiten
  - Einstellungen und „Änderungen verwerfen?“
  - das Home-Assistant-Beispiel im Profil

## Gegenprüfung der Umsetzung und Nachbesserung

Eine weitere unabhängige Prüfung hat die Umsetzung in der laufenden App nachvollzogen:
- 320 und 390 px, hell und dunkel
- axe-core, Tippflächen, Fokus
- Server-Sync direkt
- 20.000 Ablesungen

**Ergebnis:**
- 23 Punkte sind erledigt. Teilweise erledigt waren U1, U9, U15 und U25 (U27 bewusst nur teilweise).
- Die Rechenwerte stimmen nachgerechnet.
- Keine Überbreite, Tippen bleibt flüssig.

Gefundene Punkte, alle behoben und mit Tests belegt:

| Punkt | Schwere | Problem | Lösung |
| --- | --- | --- | --- |
| N1 | mittel | „Als Zählerwechsel markieren“ warnte bei einem korrekten Endstand („höher als die spätere Ablesung“), weil mit Ständen des neuen Zählers verglichen wurde. | Endstand nur gegen Ablesungen bis zum Wechsel prüfen, in Dialog und Bearbeiten. Test mit zwei Folgeablesungen. |
| N2 | mittel | Abgeschwächter Ø bei veraltetem Stand: Kontrast 2,3:1. | Keine Abschwächung; der Hinweis genügt. |
| N3 | mittel | Zähler-ID-Knopf: Name ohne sichtbaren Text (WCAG 2.5.3). | Sichtbare ID plus Text für Screenreader. |
| N4 | niedrig | „Verwerfen“/Gefahr-Knöpfe: Kontrast 4,36:1. | Dunkleres Rot. |
| N5 | niedrig | Bearbeiten bei 320 px: Feld zu schmal, Endstand ohne Einheit. | Unter 360 px einspaltig, Einheit am Endstand. |
| N6 | niedrig | Toast sprang nach dem Speichern von oben nach unten. | Position wird beim Erscheinen festgelegt. |
| N7 | niedrig | Aktionen aus Hinweisen bei zugeklapptem Verlauf wirkungslos; Fokus im falschen Feld; nach Speichern Fokus verloren; Esc im Bearbeiten schloss das ganze Sheet. | Verlauf klappt auf, Fokus im Endstand, Fokus zurück auf die Zeile, Esc bricht nur das Bearbeiten ab. |
| N8 | niedrig | Warnung doppelt (Vorschau und Meldung). Weitere Kleinigkeiten:<br>– „10,00“ neben „10,0“<br>– „+8,20“ neben „+8,2“<br>– unklarer Hinweistext<br>– Liter-Hinweis sprach von Cent<br>– widersprüchliche Texte ohne Endstand<br>– Rückfrage bei Typ- und Einheitswechsel<br>– „letzte 0 Tage“<br>– „Prognose bis“ an der Sommerzeitgrenze | Vorschau ausgeblendet, solange die Warnung steht. Die Kleinigkeiten:<br>– Stellenzahl nach dem Runden<br>– ein Format für Differenzen<br>– Zeitraum im Hinweis<br>– „Preis pro m³?“ bei Litern<br>– ein gemeinsamer Text<br>– „Zählertyp und Einheit ändern?“<br>– Kachel nur ab einem Tag<br>– `periodEnd − 1 ms` |
| N9 | niedrig | Server: leerer Name ohne Typ wurde „Zähler“. Typwechsel einer älteren App-Version ließ „Strom“ am Gaszähler stehen. „Gas“ als eigener Name eines Stromzählers ging verloren. | Leer → Standardname des gespeicherten Typs. Standardnamen folgen dem Typ, eigene Namen bleiben. Ein Standardname eines anderen Typs gilt als eigener Name. |
| N10 | niedrig | Home-Assistant-Automation ließ sich nicht direkt in den YAML-Editor der Oberfläche einfügen, `id` fehlte. | Einzelner Eintrag mit `id`, Hinweis für automations.yaml. |
| N11 | niedrig | „Jetzt ablesen?“ öffnete die Details. | Öffnet das Ablesen. |
| U1 (Rest) | mittel | Ein schon gespeicherter Cent-Preis zeigte auf Karte und in den Details weiter absurde Beträge (z. B. „≈ 107.735 € Nachzahlung“). | Keine Beträge, stattdessen „Preis prüfen – in Cent statt Euro eingetragen?“ auf der Karte und der Hinweis in den Details. |
