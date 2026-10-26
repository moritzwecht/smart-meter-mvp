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
const { sendReadingReminders, cleanup } = await import("@/lib/server/cron");

let server: TestServer;
let token: string;
let meterId: string;

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
        const first = await post({ meterId, value: "12345.6" });
        expect(first.status).toBe(201);
        expect((await post({ meterId, value: 12345.6 })).status).toBe(200); // unverändert
        const lower = await post({ meterId, value: 0 });
        expect(lower.status).toBe(422);
        expect((await post({ meterId, value: 0, isReplacement: true })).status).toBe(201);
        // kurz darauf: aktualisiert statt neuer Eintrag
        const update = await post({ meterId, value: 0.4 });
        expect(update.status).toBe(200);
        expect((await update.json()).status).toBe("updated");
        const rows = (await server.client.query<{ source: string }>(`select source from readings`)).rows;
        expect(rows).toHaveLength(2);
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
