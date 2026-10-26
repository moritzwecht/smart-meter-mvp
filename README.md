# My Home

Mobile-first Haushalts-App für **Zählerstände** (Strom, Gas, Wasser), **Listen** und **Notizen** – gemeinsam mit anderen im Haushalt und **vollständig offline nutzbar**. Läuft als PWA im Browser und als iOS-/Android-App (Capacitor).

## Funktionen

- **Zähler**: Ablesungen mit Datum, Plausibilitätsprüfung (Tippfehler, Zählerwechsel), Ø-Verbrauch gesamt und der letzten 30 Tage, Monatsdiagramm, Prognose fürs Abrechnungsjahr mit voraussichtlichem Guthaben bzw. Nachzahlung. Gas wird bei Bedarf über Zustandszahl × Brennwert in kWh umgerechnet.
- **Listen**: direkt im Widget abhaken, erledigte Punkte gesammelt entfernen.
- **Notizen** mit Autosave.
- **Haushalte**: mehrere Haushalte, Mitglieder per Einladungslink, Inhaber/Mitglieder, Haushalt verlassen.
- **Anmeldung ohne Passwort**: E-Mail eingeben, Code aus der Mail eintippen – fertig.
- **Offline**: Alles wird lokal gespeichert und im Hintergrund synchronisiert – auch Änderungen mehrerer Geräte gleichzeitig.
- **Home Assistant / ESPHome**: Zählerstände automatisch per API-Token eintragen.
- **Ablese-Erinnerung** per Push-Benachrichtigung (monatlich, nur wenn wirklich etwas fehlt).

## Technik

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Drizzle ORM · PostgreSQL (Neon) · Dexie (IndexedDB) · Serwist (Service Worker) · Capacitor 6 · Vitest

### Offline-Sync in Kürze

```
UI ──► repo.ts ──► IndexedDB (sofort sichtbar) + Outbox
                         │
              sync-engine.ts (nach Änderungen, beim Start, online, alle 30 s)
                         │  POST /api/sync { since, ops }   ← ein Request: Push + Pull
                         ▼
               server/sync.ts ──► Postgres (Soft-Delete, updated_at)
```

- Datensätze bekommen **UUIDs auf dem Client** → Operationen sind idempotent, doppelt senden schadet nie.
- Die **Outbox führt Änderungen zusammen** (z. B. 100 Autosaves → ein Update; anlegen + löschen → nichts) – aber nie in eine Operation, die schon einmal gesendet wurde. So geht auch bei einem Verbindungsabbruch mitten im Request keine Eingabe verloren.
- **Abgelehnte Operationen blockieren nie** die Warteschlange; danach wird der echte Stand neu geladen.
- **Delta-Sync**: es kommen nur Änderungen seit dem letzten Stand (inkl. Löschungen), nach > 30 Tagen der volle Bestand.
- Mehrere Tabs stimmen sich über die Web Locks API ab; Requests brechen nach 30 s ab, statt den Sync zu blockieren.
- Jeder Request sagt, für welches Konto die lokalen Daten sind – ist im Browser inzwischen ein anderes Konto angemeldet, wird nichts übertragen.

Details: `src/lib/offline/` (Client) und `src/lib/server/sync.ts` (Server).

## Entwicklung

```bash
npm install
cp .env.example .env.local   # DATABASE_URL + AUTH_SECRET eintragen
npm run db:migrate           # Schema anlegen
npm run dev
```

Jede Postgres-Datenbank funktioniert (lokal, Docker, Neon). Für Neon-URLs wird automatisch der HTTP-Treiber genutzt.

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver (ohne Service Worker) |
| `npm run build` | Produktions-Build inkl. Service Worker (`serwist build`) |
| `npm run check` | Typecheck + ESLint + Tests |
| `npm test` | Unit-, Server- und Sync-Tests (PGlite – keine Datenbank nötig) |
| `npm run test:browser` | Ende-zu-Ende im Browser gegen den Produktions-Build (braucht `npm run build` und eine **leere Test-Datenbank** in `E2E_DATABASE_URL`; E-Mails landen in einem Test-Postfach) |
| `npm run db:generate` | Migration aus Schema-Änderungen erzeugen |
| `npm run db:migrate` | Migrationen anwenden |

> ⚠️ Bitte nicht mehr `drizzle-kit push` verwenden – Schemaänderungen immer als Migration (`db:generate` → `db:migrate`), sonst passen Datenbank und Migrationen nicht mehr zusammen.

## Deployment (Vercel)

Umgebungsvariablen: siehe [`.env.example`](.env.example). Pflicht sind `DATABASE_URL` (oder das von Vercel gesetzte `POSTGRES_URL`), `AUTH_SECRET` und – weil die Anmeldung per Code läuft – `RESEND_API_KEY` mit `EMAIL_FROM` (Absender einer bei Resend verifizierten Domain). Lokal ohne Resend steht der Code in der Server-Konsole.

**Upgrade von Version 1.x** – die Migration stellt das Datenmodell um (UUIDs, echte Zahlen/Booleans, Soft-Delete):

1. Optional ein Backup in Neon anlegen (Branch). Die Migration legt zusätzlich Kopien aller alten Tabellen im Schema `v1_backup` an.
   Vorab lohnt ein Blick auf doppelte E-Mail-Adressen (Version 1 hat Groß-/Kleinschreibung unterschieden; die Migration führt solche Konten zusammen):
   ```sql
   SELECT lower(trim(email)), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;
   ```
2. `DATABASE_URL=<Produktions-URL> npm run db:migrate` – läuft in einer Transaktion: entweder alles oder nichts.
3. Direkt danach deployen.
4. Beim ersten Öffnen lädt die App alle Daten neu. Offline-Änderungen, die in Version 1 hängen geblieben waren, werden automatisch übernommen. Bestehende Sessions werden übernommen (alte Sessions galten max. 24 h – danach einmal neu anmelden). Angemeldet wird sich ab jetzt immer mit einem Code per E-Mail; Passwörter gibt es nicht mehr, die alten Hashes werden gelöscht.
5. Wenn alles läuft: `DROP SCHEMA v1_backup CASCADE;`

**Anmeldung & Sicherheit in Kürze:** Keine Passwörter – man gibt die E-Mail-Adresse ein und bekommt einen 6-stelligen Code (10 Minuten gültig, nur der zuletzt angeforderte gilt, nach 5 falschen Eingaben verbraucht; dazu Limits pro Adresse und IP). Neue Konten entstehen beim ersten Anmelden. Gespeichert wird nur ein HMAC des Codes. Code statt Link, weil Links auf dem Handy oft im falschen Browser landen statt in der Home-Bildschirm- oder nativen App. Sessions sind signierte JWTs im `__Host-`-Cookie (90 Tage, „überall abmelden“ im Profil).

Der tägliche Job (`/api/cron/daily`: Erinnerungen + Aufräumen) ist in `vercel.json` eingetragen und braucht `CRON_SECRET`. Ohne Vercel kann ihn z. B. n8n täglich aufrufen: `GET /api/cron/daily` mit Header `Authorization: Bearer <CRON_SECRET>`.

## Home Assistant / ESPHome

1. In der App unter **Profil → Home Assistant & API** einen Token erstellen (wird nur einmal angezeigt).
2. Dort stehen auch die Zähler-IDs und ein fertiges Beispiel für `configuration.yaml`.

```bash
# Zähler & IDs
curl -H "Authorization: Bearer mh_…" https://home.moritz-wecht.de/api/v1/meters

# Stand eintragen (Zahl oder String; date optional, ISO 8601)
curl -X POST https://home.moritz-wecht.de/api/v1/readings \
  -H "Authorization: Bearer mh_…" -H "Content-Type: application/json" \
  -d '{"meterId":"<uuid>","value":12345.6}'
```

Antworten: `201` neu, `200` unverändert (gleicher Wert wie zuletzt), `422` Wert kleiner als zuvor (Schutz vor Sensor-Resets – bei echtem Zählerwechsel `"isReplacement": true` mitsenden).

## Push-Benachrichtigungen

```bash
npx web-push generate-vapid-keys
```

Die Schlüssel als `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT` setzen. Danach im Profil den Erinnerungstag wählen und das Gerät aktivieren. Auf iPhone/iPad funktioniert Web-Push nur, wenn die App über Safari zum Home-Bildschirm hinzugefügt wurde (nicht in der Capacitor-App).

## Native Apps (Capacitor)

Die Apps laden die Web-App von `home.moritz-wecht.de`. Nach Änderungen an `capacitor.config.ts`:

```bash
npx cap sync
```

Für iOS ist die Domain als *App-Bound Domain* eingetragen (`Info.plist`), damit der Service Worker und damit der Offline-Start im WKWebView funktionieren.

## Projektstruktur

```
src/
  app/                  Seiten, Route Handler (api/*) und Server Actions (actions/*)
  components/           UI (dashboard/, auth/, ui/ = Basiskomponenten)
  lib/
    db/schema.ts        Datenbankschema (Drizzle)
    offline/            Client: IndexedDB, Outbox, Sync-Engine, Hooks, Session
    server/             Server: Session, Zugriff, Sync, API, Push, Cron, E-Mail
    sync/               gemeinsame Typen + Validierung (zod)
    meter/              Verbrauchs- und Kostenberechnung
drizzle/                Migrationen
tests/                  Unit-, Server- und Ende-zu-Ende-Tests
```

Gestaltung: siehe [STYLING_GUIDE.md](STYLING_GUIDE.md).
