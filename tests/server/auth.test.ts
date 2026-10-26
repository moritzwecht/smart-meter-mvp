/**
 * Auth-Flows gegen eine echte Datenbank (PGlite). Cookies/Header von Next.js
 * werden durch einen einfachen In-Memory-Store ersetzt.
 */
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authTokens, householdUsers, users } from "@/lib/db/schema";
import { setupServer, type TestServer } from "../support/server";

const jar = new Map<string, string>();
const sentMails: { to: string; url?: string }[] = [];

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
        set: (name: string, value: string, opts?: { maxAge?: number }) => {
            if (opts?.maxAge === 0 || value === "") jar.delete(name);
            else jar.set(name, value);
        },
    }),
    headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

vi.mock("@/lib/server/email", () => ({
    isEmailConfigured: () => true,
    sendMail: async (mail: { to: string; action?: { url: string } }) => {
        sentMails.push({ to: mail.to, url: mail.action?.url });
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
    // Passwort für Moritz setzen
    await server.db.update(users).set({ password: await hash("richtig-gut-123", 4) }).where(eq(users.id, server.users.moritz.id));
});

const tokenFrom = (url?: string) => url!.split("/").pop()!;

describe("Login & Registrierung", () => {
    it("meldet mit korrektem Passwort an und setzt eine Session", async () => {
        const result = await auth.login({ email: " Moritz@Example.com ", password: "richtig-gut-123" });
        expect(result).toMatchObject({ ok: true, data: { email: "moritz@example.com" } });
        expect((await getCurrentUser())?.id).toBe(server.users.moritz.id);
    });

    it("gibt bei falschem Passwort eine verständliche Fehlermeldung zurück (kein throw)", async () => {
        const result = await auth.login({ email: "moritz@example.com", password: "falsch" });
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toMatch(/^E-Mail oder Passwort ist falsch/);
    });

    it("verrät nicht, ob ein Konto (noch) kein Passwort hat", async () => {
        await server.db.insert(users).values({ email: "alt@example.com" });
        const ohnePasswort = await auth.login({ email: "alt@example.com", password: "irgendwas" });
        const gibtsNicht = await auth.login({ email: "niemand@example.com", password: "irgendwas" });
        expect(ohnePasswort).toEqual(gibtsNicht);
    });

    it("SICHERHEIT: parallele Fehlversuche umgehen das Limit nicht", async () => {
        const results = await Promise.all(Array.from({ length: 30 }, (_, i) => auth.login({ email: "moritz@example.com", password: `falsch${i}` })));
        // Höchstens 10 Passwörter wurden wirklich geprüft – der Rest wurde abgewiesen
        const checked = results.filter((r) => !r.ok && /^E-Mail oder Passwort/.test(r.error));
        expect(checked.length).toBeLessThanOrEqual(10);
        expect(results.length - checked.length).toBeGreaterThanOrEqual(20);
    });

    it("abgewiesene Versuche verlängern die Sperre nicht und landen nicht in der Datenbank", async () => {
        for (let i = 0; i < 10; i++) await auth.login({ email: "moritz@example.com", password: `falsch${i}` });
        const before = await server.count("auth_attempts");
        for (let i = 0; i < 20; i++) await auth.login({ email: "moritz@example.com", password: "egal" });
        expect(await server.count("auth_attempts")).toBe(before);
    });

    it("bremst Brute-Force nach 10 Fehlversuchen", async () => {
        for (let i = 0; i < 10; i++) await auth.login({ email: "moritz@example.com", password: `falsch${i}` });
        const result = await auth.login({ email: "moritz@example.com", password: "richtig-gut-123" });
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toMatch(/Zu viele Fehlversuche/);
    });

    it("SICHERHEIT: Registrierung kann ein bestehendes Konto ohne Passwort NICHT übernehmen", async () => {
        // z. B. ein Platzhalter aus einer alten Einladung
        await server.db.insert(users).values({ email: "opfer@example.com" });
        const result = await auth.register({ email: "opfer@example.com", password: "angreifer-123" });
        expect(result.ok).toBe(false);
        expect(jar.size).toBe(0);
        const [opfer] = await server.db.select().from(users).where(eq(users.email, "opfer@example.com"));
        expect(opfer.password).toBeNull();
    });

    it("registriert neue Konten (E-Mail wird normalisiert, Passwort ≥ 8 Zeichen)", async () => {
        expect((await auth.register({ email: "neu@example.com", password: "kurz" })).ok).toBe(false);
        const result = await auth.register({ email: "Neu@Example.COM", password: "lang-genug" });
        expect(result).toMatchObject({ ok: true, data: { email: "neu@example.com", name: "neu" } });
        expect((await auth.register({ email: "neu@example.com", password: "lang-genug" })).ok).toBe(false);
    });
});

describe("Passwort vergessen", () => {
    it("setzt per E-Mail-Link ein Passwort – auch für Konten ohne Passwort – und beendet alte Sessions", async () => {
        await server.db.insert(users).values({ email: "platzhalter@example.com" });
        expect(await auth.requestPasswordReset({ email: "platzhalter@example.com" })).toEqual({ ok: true, data: null });
        expect(sentMails).toHaveLength(1);

        const token = tokenFrom(sentMails[0].url);
        const result = await auth.resetPassword({ token, password: "neues-passwort" });
        expect(result).toMatchObject({ ok: true, data: { email: "platzhalter@example.com", hasPassword: true } });
        // Link ist nur einmal gültig
        expect((await auth.resetPassword({ token, password: "nochmal-1234" })).ok).toBe(false);
    });

    it("beendet beim Zurücksetzen auch andere Reset-Links und API-Tokens", async () => {
        const { createApiToken } = await import("@/lib/server/api-tokens");
        await createApiToken(server.users.moritz.id, "Home Assistant");
        await auth.requestPasswordReset({ email: "moritz@example.com" });
        await auth.requestPasswordReset({ email: "moritz@example.com" });
        expect(sentMails).toHaveLength(2);
        expect((await auth.resetPassword({ token: tokenFrom(sentMails[0].url), password: "ganz-neu-123" })).ok).toBe(true);
        expect(await server.count("api_tokens")).toBe(0);
        // Der zweite Link gilt nicht mehr
        expect((await auth.resetPassword({ token: tokenFrom(sentMails[1].url), password: "noch-neuer-123" })).ok).toBe(false);
    });

    it("verrät nicht, ob es ein Konto gibt", async () => {
        expect(await auth.requestPasswordReset({ email: "gibtsnicht@example.com" })).toEqual({ ok: true, data: null });
        expect(sentMails).toHaveLength(0);
    });
});

describe("Einladungen", () => {
    async function inviteAnna() {
        await auth.login({ email: "moritz@example.com", password: "richtig-gut-123" });
        const result = await householdActions.inviteMember({ householdId: server.households.zuhause.id, email: "neu@example.com" });
        expect(result.ok).toBe(true);
        jar.clear();
        return tokenFrom(result.ok ? result.data.link : undefined);
    }

    it("nur Inhaber dürfen einladen", async () => {
        await server.db.update(users).set({ password: await hash("anna-passwort", 4) }).where(eq(users.id, server.users.anna.id));
        await auth.login({ email: "anna@example.com", password: "anna-passwort" });
        const result = await householdActions.inviteMember({ householdId: server.households.zuhause.id, email: "x@example.com" });
        expect(result).toEqual({ ok: false, error: "Nur Inhaber können das." });
    });

    it("Registrierung über den Einladungslink tritt direkt dem Haushalt bei", async () => {
        const token = await inviteAnna();
        const result = await auth.register({ email: "neu@example.com", password: "lang-genug", inviteToken: token });
        expect(result.ok).toBe(true);
        const user = await getCurrentUser();
        const membership = await server.db.query.householdUsers.findFirst({ where: eq(householdUsers.userId, user!.id) });
        expect(membership?.householdId).toBe(server.households.zuhause.id);
        // Token verbraucht
        const [t] = await server.db.select().from(authTokens);
        expect(t.usedAt).not.toBeNull();
    });

    it("nach der Registrierung über die Einladung meldet acceptInvite keinen Fehler", async () => {
        const token = await inviteAnna();
        await auth.register({ email: "neu@example.com", password: "lang-genug", inviteToken: token });
        expect(await auth.acceptInvite({ token })).toEqual({ ok: true, data: { householdId: server.households.zuhause.id } });
    });

    it("SICHERHEIT: ein Einladungslink taugt nicht zur Übernahme eines Kontos ohne Passwort", async () => {
        // Angreifer lädt die Adresse eines alten Kontos (ohne Passwort) in seinen Haushalt ein …
        await server.db.insert(users).values({ email: "opfer@example.com" });
        await auth.login({ email: "moritz@example.com", password: "richtig-gut-123" });
        const invite = await householdActions.inviteMember({ householdId: server.households.zuhause.id, email: "opfer@example.com" });
        jar.clear();
        const token = tokenFrom(invite.ok ? invite.data.link : undefined);
        // … und versucht, damit ein Passwort für das Konto zu setzen
        const result = await auth.register({ email: "opfer@example.com", password: "angreifer-123", inviteToken: token });
        expect(result.ok).toBe(false);
        expect(await getCurrentUser()).toBeNull();
        const opfer = await server.db.query.users.findFirst({ where: eq(users.email, "opfer@example.com") });
        expect(opfer?.password).toBeNull();
    });

    it("ein Einladungslink kann nur einmal verwendet werden", async () => {
        const token = await inviteAnna();
        await auth.register({ email: "neu@example.com", password: "lang-genug", inviteToken: token });
        jar.clear();
        await server.db.update(users).set({ password: await hash("fremd-passwort", 4) }).where(eq(users.id, server.users.fremd.id));
        await auth.login({ email: "fremd@example.com", password: "fremd-passwort" });
        expect((await auth.acceptInvite({ token })).ok).toBe(false);
    });
});
