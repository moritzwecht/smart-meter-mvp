import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiToken } from "@/lib/server/api-tokens";
import { setupServer, type TestServer } from "../support/server";

const pushes: { userId: number; body: string }[] = [];
vi.mock("@/lib/server/push", () => ({
    isPushConfigured: () => true,
    sendPushToUser: async (userId: number, payload: { body: string }) => {
        pushes.push({ userId, body: payload.body });
        return { sent: 1, removed: 0 };
    },
}));

const readingsRoute = await import("@/app/api/v1/readings/route");
const metersRoute = await import("@/app/api/v1/meters/route");
const cronRoute = await import("@/app/api/cron/daily/route");
const { sendReadingReminders, cleanup, berlinDayOfMonth } = await import("@/lib/server/cron");

let server: TestServer;
let token: string;
let meterId: string;

/** Feste Zeitpunkte (Minuten ab einer vollen Stunde vor 10 Tagen) – unabhängig davon, wann der Test läuft */
const T0 = Math.floor((Date.now() - 10 * 86_400_000) / 3_600_000) * 3_600_000;
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();
const values = async () =>
    (await server.client.query<{ value: number; is_replacement: boolean }>(`select value::float as value, is_replacement from readings order by date, created_at`)).rows;

const post = (body: unknown, auth = `Bearer ${token}`) =>
    readingsRoute.POST(
        new Request("http://localhost/api/v1/readings", {
            method: "POST",
            headers: { authorization: auth, "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
    );

beforeEach(async () => {
    server = await setupServer();
    pushes.length = 0;
    token = (await createApiToken(server.users.moritz.id, "Home Assistant")).token;
    meterId = randomUUID();
    await server.client.query(`insert into meters (id, household_id, name, type, unit) values ($1, $2, 'Strom', 'ELECTRICITY', 'kWh')`, [
        meterId,
        server.households.zuhause.id,
    ]);
});

describe("API für Home Assistant", () => {
    it("trägt Werte ein (auch als String), ignoriert Wiederholungen und schützt vor Sensor-Resets", async () => {
        const first = await post({ meterId, value: "12345.6", date: at(0) });
        expect(first.status).toBe(201);
        expect((await post({ meterId, value: 12345.6, date: at(1) })).status).toBe(200); // unverändert
        const lower = await post({ meterId, value: 0, date: at(2) });
        expect(lower.status).toBe(422);
        expect((await post({ meterId, value: 0, isReplacement: true, date: at(3) })).status).toBe(201);
        // Der Startstand des neuen Zählers wird nicht überschrieben …
        expect((await post({ meterId, value: 0.4, date: at(5) })).status).toBe(201);
        // … weitere Werte in derselben Viertelstunde aktualisieren die API-Ablesung
        const update = await post({ meterId, value: 0.5, date: at(8) });
        expect(update.status).toBe(200);
        expect((await update.json()).status).toBe("updated");
        const rows = (await server.client.query<{ source: string; value: number }>(`select source, value::float as value from readings order by date`)).rows;
        expect(rows.map((r) => r.value)).toEqual([12345.6, 0, 0.5]);
        expect(rows.every((r) => r.source === "api")).toBe(true);
    });

    it("verweigert ohne gültigen Token und für fremde Zähler", async () => {
        expect((await post({ meterId, value: 1 }, "Bearer mh_falsch_falsch_falsch_falsch")).status).toBe(401);
        expect((await post({ meterId, value: 1 }, "")).status).toBe(401);
        const fremdToken = (await createApiToken(server.users.fremd.id, "x")).token;
        expect((await post({ meterId, value: 1 }, `Bearer ${fremdToken}`)).status).toBe(404);
    });

    it("validiert Eingaben verständlich", async () => {
        const res = await post({ meterId: "123", value: "abc" });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/meterId/);
    });

    it("listet die Zähler mit letztem Stand", async () => {
        await post({ meterId, value: 100 });
        const res = await metersRoute.GET(new Request("http://localhost/api/v1/meters", { headers: { authorization: `Bearer ${token}` } }));
        const { meters } = await res.json();
        expect(meters).toEqual([
            expect.objectContaining({ id: meterId, type: "ELECTRICITY", household: "Zuhause", lastReading: expect.objectContaining({ value: 100 }) }),
        ]);
    });
});

describe("Täglicher Job", () => {
    it("ist ohne CRON_SECRET bzw. mit falschem Secret gesperrt", async () => {
        vi.stubEnv("CRON_SECRET", "");
        expect((await cronRoute.GET(new Request("http://localhost/api/cron/daily"))).status).toBe(503);
        vi.stubEnv("CRON_SECRET", "geheim");
        expect((await cronRoute.GET(new Request("http://localhost/api/cron/daily", { headers: { authorization: "Bearer falsch" } }))).status).toBe(401);
        const ok = await cronRoute.GET(new Request("http://localhost/api/cron/daily", { headers: { authorization: "Bearer geheim" } }));
        expect(ok.status).toBe(200);
        vi.unstubAllEnvs();
    });

    it("erinnert am eingestellten Tag nur, wenn ein Zähler lange keinen Stand hat", async () => {
        const now = new Date("2026-03-15T07:00:00Z");
        await server.client.query(`update users set reminder_day = 15 where id = $1`, [server.users.moritz.id]);
        await server.client.query(`update users set reminder_day = 14 where id = $1`, [server.users.anna.id]);
        expect(await sendReadingReminders(now)).toEqual({ due: 1, notified: 1 });
        expect(pushes).toEqual([{ userId: server.users.moritz.id, body: "Strom wartet auf einen neuen Stand." }]);

        pushes.length = 0;
        await server.client.query(`insert into readings (id, meter_id, value, date) values ($1, $2, 1, $3)`, [randomUUID(), meterId, new Date("2026-03-14T08:00:00Z")]);
        expect(await sendReadingReminders(now)).toEqual({ due: 1, notified: 0 });
    });

    it("räumt alte Löschmarkierungen auf, frische bleiben", async () => {
        const old = randomUUID();
        const recent = randomUUID();
        await server.client.query(
            `insert into notes (id, household_id, title, deleted_at) values ($1, $3, 'alt', now() - interval '90 days'), ($2, $3, 'neu', now() - interval '1 day')`,
            [old, recent, server.households.zuhause.id],
        );
        const purged = await cleanup();
        expect(purged.notes).toBe(1);
        expect(await server.count("notes")).toBe(1);
    });
});

describe("Prüfung Zähler: API", () => {
    it("B9: mehr als 4 Nachkommastellen – beim zweiten Senden weder 422 noch eine doppelte Zeile", async () => {
        expect((await post({ meterId, value: 100.00009, date: at(0) })).status).toBe(201);
        const up = await post({ meterId, value: 100.00009, date: at(60) });
        expect((await up.json()).status).toBe("unchanged");
        expect((await post({ meterId, value: 200.00004, date: at(120) })).status).toBe(201);
        const down = await post({ meterId, value: 200.00004, date: at(180) });
        expect((await down.json()).status).toBe("unchanged");
        expect(await values()).toEqual([
            { value: 100.0001, is_replacement: false },
            { value: 200, is_replacement: false },
        ]);
    });

    it("N2: feste Viertelstunden – eine Automation alle 10 Minuten ergibt eine Ablesung pro Viertelstunde, nicht eine einzige", async () => {
        for (let i = 0; i <= 18; i++) expect((await post({ meterId, value: 1000 + i, date: at(i * 10) })).status).toBeLessThan(300);
        const rows = await values();
        expect(rows).toHaveLength(13); // 3 Stunden = 12 Viertelstunden + die erste der nächsten
        expect(rows[rows.length - 1].value).toBe(1018);
    });

    it("N2: ein Zählerwechsel wird nie überschrieben", async () => {
        await post({ meterId, value: 5000, date: at(0) });
        await post({ meterId, value: 0, date: at(61), isReplacement: true });
        await post({ meterId, value: 0.4, date: at(62) });
        expect(await values()).toEqual([
            { value: 5000, is_replacement: false },
            { value: 0, is_replacement: true },
            { value: 0.4, is_replacement: false },
        ]);
    });

    it("B1: nach einem Tippfehler in der App (Ziffer zu viel) nimmt die API wieder Werte an", async () => {
        await post({ meterId, value: 1000, date: at(0) });
        await server.client.query(`insert into readings (id, meter_id, value, date, source) values ($1, $2, 10500, $3, 'app')`, [randomUUID(), meterId, at(60)]);
        expect((await post({ meterId, value: 1100, date: at(120) })).status).toBe(201);
        // ein echter Sensor-Reset bleibt abgelehnt
        expect((await post({ meterId, value: 0, date: at(180) })).status).toBe(422);
    });

    it("B7: ein Nachtrag darf nicht über einer späteren Ablesung liegen", async () => {
        await post({ meterId, value: 1000, date: at(0) });
        await post({ meterId, value: 1100, date: at(600) });
        const res = await post({ meterId, value: 1200, date: at(300) });
        expect(res.status).toBe(422);
        expect((await res.json()).error).toMatch(/spätere Ablesung/);
        expect((await post({ meterId, value: 1050, date: at(300) })).status).toBe(201);
    });

    it("N5: ein gleichbleibender Wert wird einmal am Tag gespeichert – keine Erinnerung für einen meldenden Zähler", async () => {
        const now = new Date();
        for (let d = 9; d >= 0; d--) await post({ meterId, value: 50, date: new Date(now.getTime() - d * 86_400_000 - 3_600_000).toISOString() });
        expect(await server.count("readings")).toBe(10);
        // innerhalb von 20 Stunden: unverändert, keine neue Zeile
        const again = await post({ meterId, value: 50, date: now.toISOString() });
        expect((await again.json()).status).toBe("unchanged");
        await server.client.query(`update users set reminder_day = $2 where id = $1`, [server.users.moritz.id, berlinDayOfMonth(now)]);
        await server.client.query(`update users set reminder_day = null where id <> $1`, [server.users.moritz.id]);
        expect((await sendReadingReminders(now)).notified).toBe(0);
    });
});
