import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createEmptyDb, createMigratedDb, MIGRATIONS_DIR, runSqlFile } from "../support/pglite";

type Row = Record<string, unknown>;

describe("Migrationen", () => {
    it("erzeugen auf einer leeren Datenbank exakt das Drizzle-Schema", async () => {
        const { db } = await createMigratedDb();
        const { pushSchema } = await import("drizzle-kit/api");
        const schema = await import("@/lib/db/schema");
        const { statementsToExecute } = await pushSchema(schema, db as never);
        expect(statementsToExecute).toEqual([]);
    });

    it("konvertieren eine befüllte Version-1-Datenbank verlustfrei", async () => {
        const { client, db } = await createEmptyDb();
        await runSqlFile(client, "0000_legacy_baseline.sql");

        // Daten so, wie Version 1 sie geschrieben hat (Text-Booleans, Komma-Zahlen, gemischte E-Mails)
        await client.exec(`
            INSERT INTO users (id, email, password, name) VALUES
                (1, 'moritz@example.com', 'hash', 'Moritz'),
                (2, 'Anna@Example.com', NULL, NULL),       -- eingeladener Platzhalter
                (3, 'anna@example.com', 'hash2', 'Anna');  -- später selbst registriert
            SELECT setval('users_id_seq', 3);
            INSERT INTO households (id, name, user_id) VALUES (10, 'Zuhause', 1), (11, 'Ferienhaus', 1);
            SELECT setval('households_id_seq', 11);
            -- Haushalt 11 hat (wie bei sehr alten Daten) keine Mitgliedschaft, nur user_id
            INSERT INTO household_users (household_id, user_id, role) VALUES
                (10, 1, 'OWNER'), (10, 2, 'MEMBER'), (10, 3, 'MEMBER');
            INSERT INTO meters (id, name, type, household_id, unit, is_pinned, monthly_payment, basic_fee, price_per_unit, z_number, calorific_value, price_unit) VALUES
                (100, 'Strom', 'ELECTRICITY', 10, 'kWh', 'true', '85,50', '12', '0,3245', NULL, NULL, NULL),
                (101, 'Gas', 'GAS', 10, 'm³', 'false', '1.234,56', '', '0.12', '0,9512', '11,2', 'kwh'),
                (102, 'Wasser', 'WATER', 999, 'm³', 'false', NULL, NULL, NULL, NULL, NULL, NULL); -- verwaist
            INSERT INTO readings (id, meter_id, value, date) VALUES
                (1000, 100, '12345.6', '2026-01-01 08:00:00'),
                (1001, 100, '12400,25', '2026-01-15 08:00:00'),
                (1002, 101, 'kaputt', '2026-01-15 08:00:00');
            INSERT INTO todo_lists (id, name, household_id, is_pinned) VALUES (200, 'Einkauf', 10, 'true');
            INSERT INTO todo_items (id, list_id, content, completed) VALUES (300, 200, 'Milch', 'true'), (301, 200, 'Brot', 'false');
            INSERT INTO notes (id, title, content, household_id, is_pinned) VALUES (400, 'WLAN', 'geheim', 11, 'false');
        `);

        await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
        const q = async (sql: string) => (await client.query<Row>(sql)).rows;

        // Nutzer: Dublette zusammengeführt (registrierter Account gewinnt), E-Mails klein
        expect(await q(`SELECT id, email FROM users ORDER BY id`)).toEqual([
            { id: 1, email: "moritz@example.com" },
            { id: 3, email: "anna@example.com" },
        ]);

        // Mitgliedschaften: Anna nur einmal, Ferienhaus bekommt Inhaber-Mitgliedschaft
        expect(await q(`SELECT household_id, user_id, role FROM household_users ORDER BY household_id, user_id`)).toEqual([
            { household_id: 10, user_id: 1, role: "OWNER" },
            { household_id: 10, user_id: 3, role: "MEMBER" },
            { household_id: 11, user_id: 1, role: "OWNER" },
        ]);

        // Zähler: echte Zahlen/Booleans, verwaister Zähler entfernt, alte ID erhalten
        const meters = await q(
            `SELECT legacy_id, is_pinned, monthly_payment::float8 AS mp, basic_fee::float8 AS bf,
                    price_per_unit::float8 AS ppu, z_number::float8 AS z, calorific_value::float8 AS cv, price_unit
             FROM meters ORDER BY legacy_id`,
        );
        expect(meters).toEqual([
            { legacy_id: 100, is_pinned: true, mp: 85.5, bf: 12, ppu: 0.3245, z: null, cv: null, price_unit: null },
            { legacy_id: 101, is_pinned: false, mp: 1234.56, bf: null, ppu: 0.12, z: 0.9512, cv: 11.2, price_unit: "kwh" },
        ]);

        // Ablesungen: an UUID des Zählers gehängt, Komma-Wert konvertiert, kaputter Wert entfernt
        const readings = await q(
            `SELECT r.legacy_id, r.value::float8 AS value, m.legacy_id AS meter, to_char(r.date AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS d
             FROM readings r JOIN meters m ON m.id = r.meter_id ORDER BY r.legacy_id`,
        );
        expect(readings).toEqual([
            { legacy_id: 1000, value: 12345.6, meter: 100, d: "2026-01-01 08:00" },
            { legacy_id: 1001, value: 12400.25, meter: 100, d: "2026-01-15 08:00" },
        ]);

        expect(await q(`SELECT i.content, i.completed, l.is_pinned FROM todo_items i JOIN todo_lists l ON l.id = i.list_id ORDER BY i.legacy_id`)).toEqual([
            { content: "Milch", completed: true, is_pinned: true },
            { content: "Brot", completed: false, is_pinned: true },
        ]);
        expect(await q(`SELECT title, household_id, deleted_at FROM notes`)).toEqual([
            { title: "WLAN", household_id: 11, deleted_at: null },
        ]);

        // Sicherungskopien vorhanden, Hilfsfunktion aufgeräumt
        expect((await q(`SELECT count(*)::int AS n FROM v1_backup.meters`))[0].n).toBe(3);
        expect((await q(`SELECT count(*)::int AS n FROM pg_proc WHERE proname = '__v1_parse_decimal'`))[0].n).toBe(0);

        // updated_at-Trigger funktioniert
        await client.exec(`UPDATE notes SET updated_at = '2000-01-01' WHERE legacy_id = 400`);
        await client.exec(`UPDATE notes SET title = 'WLAN-Passwort' WHERE legacy_id = 400`);
        const [{ fresh }] = await q(`SELECT updated_at > now() - interval '1 minute' AS fresh FROM notes WHERE legacy_id = 400`);
        expect(fresh).toBe(true);

        // Und das Ergebnis entspricht exakt dem Drizzle-Schema
        const { pushSchema } = await import("drizzle-kit/api");
        const schema = await import("@/lib/db/schema");
        const { statementsToExecute } = await pushSchema(schema, db as never);
        expect(statementsToExecute).toEqual([]);
    });
});
