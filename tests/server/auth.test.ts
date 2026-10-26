/**
 * Anmeldung per Einmalcode, Sessions und Einladungen gegen eine echte Datenbank
 * (PGlite). Cookies/Header von Next.js werden durch einen In-Memory-Store ersetzt,
 * E-Mails abgefangen.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authTokens, householdUsers } from "@/lib/db/schema";
import { setupServer, type TestServer } from "../support/server";

const jar = new Map<string, string>();
const sentMails: { to: string; subject: string; url?: string }[] = [];
let mailWorks = true;
let currentIp = "203.0.113.7";

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
        set: (name: string, value: string, opts?: { maxAge?: number }) => {
            if (opts?.maxAge === 0 || value === "") jar.delete(name);
            else jar.set(name, value);
        },
    }),
    headers: async () => new Headers({ "x-forwarded-for": currentIp }),
}));

vi.mock("@/lib/server/email", () => ({
    isEmailConfigured: () => true,
    sendMail: async (mail: { to: string; subject: string; action?: { url: string } }) => {
        if (!mailWorks) return false;
        sentMails.push({ to: mail.to, subject: mail.subject, url: mail.action?.url });
        return true;
    },
}));

const auth = await import("@/app/actions/auth");
const householdActions = await import("@/app/actions/households");
const { getCurrentUser } = await import("@/lib/server/session");

let server: TestServer;

beforeEach(async () => {
    server = await setupServer();
    jar.clear();
    sentMails.length = 0;
    mailWorks = true;
    currentIp = "203.0.113.7";
});

const tokenFrom = (url?: string) => url!.split("/").pop()!;

/** Code aus der zuletzt an diese Adresse geschickten Mail */
function lastCode(email: string): string {
    const mail = sentMails.filter((m) => m.to === email).at(-1);
    const code = mail?.subject.match(/^(\d{6}) /)?.[1];
    if (!code) throw new Error(`Keine Code-Mail an ${email}`);
    return code;
}

/** Eine falsche, aber gültig aussehende Eingabe */
const wrong = (code: string) => `${(Number(code[0]) + 1) % 10}${code.slice(1)}`;

async function loginAs(email: string, inviteToken?: string) {
    expect((await auth.requestLoginCode({ email })).ok).toBe(true);
    return auth.verifyLoginCode({ email, code: lastCode(email), inviteToken });
}

describe("Anmeldung per Code", () => {
    it("schickt einen Code und meldet damit an – die E-Mail wird normalisiert", async () => {
        expect(await auth.requestLoginCode({ email: " Moritz@Example.com " })).toEqual({ ok: true, data: null });
        expect(sentMails).toHaveLength(1);
        expect(sentMails[0].to).toBe("moritz@example.com");
        const code = lastCode("moritz@example.com");
        // Mit Leerzeichen eingetippt ("123 456") geht auch
        const result = await auth.verifyLoginCode({ email: "MORITZ@example.com", code: `${code.slice(0, 3)} ${code.slice(3)}` });
        expect(result).toMatchObject({ ok: true, data: { id: server.users.moritz.id, email: "moritz@example.com" } });
        expect((await getCurrentUser())?.id).toBe(server.users.moritz.id);
    });

    it("legt beim ersten Anmelden ein Konto an", async () => {
        const result = await loginAs("neu@example.com");
        expect(result).toMatchObject({ ok: true, data: { email: "neu@example.com", name: "neu" } });
        expect(await server.count("users", "email = 'neu@example.com'")).toBe(1);
    });

    it("verrät nicht, ob es ein Konto gibt – jede Adresse bekommt einen Code", async () => {
        const vorhanden = await auth.requestLoginCode({ email: "moritz@example.com" });
        const neu = await auth.requestLoginCode({ email: "gibtsnicht@example.com" });
        expect(vorhanden).toEqual(neu);
        expect(sentMails.map((m) => m.to)).toEqual(["moritz@example.com", "gibtsnicht@example.com"]);
        expect(await server.count("users", "email = 'gibtsnicht@example.com'")).toBe(0); // erst nach dem Code
    });

    it("ein Code gilt nur einmal, und nur der zuletzt angeforderte", async () => {
        await auth.requestLoginCode({ email: "moritz@example.com" });
        const first = lastCode("moritz@example.com");
        await auth.requestLoginCode({ email: "moritz@example.com" });
        const second = lastCode("moritz@example.com");
        if (first !== second) expect((await auth.verifyLoginCode({ email: "moritz@example.com", code: first })).ok).toBe(false);
        expect((await auth.verifyLoginCode({ email: "moritz@example.com", code: second })).ok).toBe(true);
        const again = await auth.verifyLoginCode({ email: "moritz@example.com", code: second });
        expect(again).toEqual({ ok: false, error: "Der Code stimmt nicht oder ist abgelaufen." });
    });

    it("falscher Code: verständliche Meldung – nach 3 Fehlversuchen ist der Code verbraucht", async () => {
        await auth.requestLoginCode({ email: "moritz@example.com" });
        const code = lastCode("moritz@example.com");
        for (let i = 0; i < 2; i++) {
            expect(await auth.verifyLoginCode({ email: "moritz@example.com", code: wrong(code) })).toEqual({
                ok: false,
                error: "Der Code stimmt nicht oder ist abgelaufen.",
            });
        }
        const third = await auth.verifyLoginCode({ email: "moritz@example.com", code: wrong(code) });
        expect(!third.ok && third.error).toMatch(/Zu viele falsche Versuche/);
        expect((await auth.verifyLoginCode({ email: "moritz@example.com", code })).ok).toBe(false);
        expect(await getCurrentUser()).toBeNull();
    });

    it("abgelaufene Codes gelten nicht", async () => {
        await auth.requestLoginCode({ email: "moritz@example.com" });
        await server.db.update(authTokens).set({ expiresAt: new Date(Date.now() - 1000) });
        const result = await auth.verifyLoginCode({ email: "moritz@example.com", code: lastCode("moritz@example.com") });
        expect(!result.ok && result.error).toMatch(/abgelaufen/);
    });

    it("SICHERHEIT: der Code einer Adresse gilt nicht für eine andere", async () => {
        await auth.requestLoginCode({ email: "anna@example.com" });
        await auth.requestLoginCode({ email: "moritz@example.com" });
        const annasCode = lastCode("anna@example.com");
        if (annasCode !== lastCode("moritz@example.com")) {
            expect((await auth.verifyLoginCode({ email: "moritz@example.com", code: annasCode })).ok).toBe(false);
        }
    });

    it("SICHERHEIT: Codes werden nicht im Klartext oder als einfacher Hash gespeichert", async () => {
        await auth.requestLoginCode({ email: "moritz@example.com" });
        const code = lastCode("moritz@example.com");
        const [row] = await server.db.select().from(authTokens);
        expect(row.purpose).toBe("LOGIN");
        expect(row.tokenHash).not.toContain(code);
        expect(row.tokenHash).not.toContain(createHash("sha256").update(code).digest("hex"));
    });

    it("SICHERHEIT: auch parallel werden pro Code höchstens 3 Eingaben geprüft", async () => {
        await auth.requestLoginCode({ email: "moritz@example.com" });
        const code = lastCode("moritz@example.com");
        await Promise.all(Array.from({ length: 12 }, () => auth.verifyLoginCode({ email: "moritz@example.com", code: wrong(code) })));
        // Der Code ist danach verbraucht – auch der richtige hilft nicht mehr
        expect((await auth.verifyLoginCode({ email: "moritz@example.com", code })).ok).toBe(false);
        const [row] = await server.db.select().from(authTokens);
        expect(row.attempts).toBeLessThanOrEqual(3);
    });

    it("SICHERHEIT: höchstens 10 Codes pro Adresse und Tag – egal von wie vielen Netzen", async () => {
        for (let i = 0; i < 10; i++) {
            currentIp = `198.51.100.${i}`;
            expect((await auth.requestLoginCode({ email: "moritz@example.com" })).ok).toBe(true);
        }
        currentIp = "198.51.100.200";
        const eleventh = await auth.requestLoginCode({ email: "moritz@example.com" });
        expect(!eleventh.ok && eleventh.error).toMatch(/Zu viele Codes/);
    });

    it("Fremde können ein Konto nicht durch falsche Eingaben aussperren", async () => {
        currentIp = "192.0.2.66"; // Angreifer
        for (let i = 0; i < 40; i++) await auth.verifyLoginCode({ email: "moritz@example.com", code: "000000" });
        currentIp = "203.0.113.7"; // Moritz
        expect((await loginAs("moritz@example.com")).ok).toBe(true);
    });

    it("begrenzt Code-Anfragen pro Adresse und Netz – andere Netze bleiben frei", async () => {
        for (let i = 0; i < 5; i++) expect((await auth.requestLoginCode({ email: "moritz@example.com" })).ok).toBe(true);
        const sixth = await auth.requestLoginCode({ email: "moritz@example.com" });
        expect(!sixth.ok && sixth.error).toMatch(/Zu viele Codes/);
        expect(sentMails).toHaveLength(5);
        currentIp = "198.51.100.9";
        expect((await auth.requestLoginCode({ email: "moritz@example.com" })).ok).toBe(true);
    });

    it("IPv6: ein ganzes /64-Netz zählt als ein Absender", async () => {
        for (let i = 0; i < 20; i++) {
            currentIp = `2001:db8:1:2:${i.toString(16)}::1`;
            expect((await auth.requestLoginCode({ email: `opfer${i}@example.com` })).ok).toBe(true);
        }
        currentIp = "2001:0db8:0001:0002:ffff:ffff:ffff:ffff";
        const next = await auth.requestLoginCode({ email: "noch-eins@example.com" });
        expect(!next.ok && next.error).toMatch(/Zu viele Codes/);
    });

    it("begrenzt die Zahl der Code-Mails insgesamt (Schutz des Mail-Kontingents)", async () => {
        for (let i = 0; i < 30; i++) {
            currentIp = `198.18.${Math.floor(i / 10)}.${i}`;
            expect((await auth.requestLoginCode({ email: `user${i}@example.com` })).ok).toBe(true);
        }
        currentIp = "198.19.0.1";
        expect((await auth.requestLoginCode({ email: "user-x@example.com" })).ok).toBe(false);
    });

    it("meldet es, wenn die E-Mail nicht verschickt werden konnte", async () => {
        mailWorks = false;
        const result = await auth.requestLoginCode({ email: "moritz@example.com" });
        expect(!result.ok && result.error).toMatch(/nicht verschickt/);
    });
});

describe("Sessions", () => {
    it("„Überall abmelden“ beendet andere Sessions, dieses Gerät bleibt angemeldet", async () => {
        await loginAs("moritz@example.com");
        const otherDevice = new Map(jar);
        expect((await auth.logoutEverywhere()).ok).toBe(true);
        expect((await getCurrentUser())?.id).toBe(server.users.moritz.id);
        jar.clear();
        for (const [k, v] of otherDevice) jar.set(k, v);
        expect(await getCurrentUser()).toBeNull();
    });

    it("Abmelden löscht das Cookie", async () => {
        await loginAs("moritz@example.com");
        await auth.logout();
        expect(await getCurrentUser()).toBeNull();
    });
});

describe("Einladungen", () => {
    async function invite(email = "neu@example.com") {
        await loginAs("moritz@example.com");
        const result = await householdActions.inviteMember({ householdId: server.households.zuhause.id, email });
        expect(result.ok).toBe(true);
        jar.clear();
        return tokenFrom(result.ok ? result.data.link : undefined);
    }

    it("nur Inhaber dürfen einladen", async () => {
        await loginAs("anna@example.com");
        const result = await householdActions.inviteMember({ householdId: server.households.zuhause.id, email: "x@example.com" });
        expect(result).toEqual({ ok: false, error: "Nur Inhaber können das." });
    });

    it("Anmelden mit Code über den Einladungslink tritt direkt dem Haushalt bei", async () => {
        const token = await invite();
        expect((await loginAs("neu@example.com", token)).ok).toBe(true);
        const user = await getCurrentUser();
        const membership = await server.db.query.householdUsers.findFirst({ where: eq(householdUsers.userId, user!.id) });
        expect(membership?.householdId).toBe(server.households.zuhause.id);
        // danach meldet acceptInvite keinen Fehler
        expect(await auth.acceptInvite({ token })).toEqual({ ok: true, data: { householdId: server.households.zuhause.id } });
    });

    it("bestehende Konten treten über die Einladung ebenfalls bei", async () => {
        const token = await invite("fremd@example.com");
        await loginAs("fremd@example.com", token);
        expect(await server.count("household_users", `user_id = ${server.users.fremd.id} and household_id = ${server.households.zuhause.id}`)).toBe(1);
    });

    it("ein Einladungslink kann nur einmal verwendet werden", async () => {
        const token = await invite();
        await loginAs("neu@example.com", token);
        jar.clear();
        await loginAs("fremd@example.com");
        expect((await auth.acceptInvite({ token })).ok).toBe(false);
    });
});

describe("Passwörter gibt es nicht mehr", () => {
    it("keine Passwort-Anmeldung und keine gespeicherten Passwort-Hashes", async () => {
        expect("login" in auth).toBe(false);
        const columns = await server.client.query<{ column_name: string }>(
            "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users'",
        );
        expect(columns.rows.map((c) => c.column_name)).not.toContain("password");
        expect((await loginAs("moritz@example.com")).ok).toBe(true);
    });
});
