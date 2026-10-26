import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { closeDb, count, q } from "./db";

/*
 * Der komplette Weg einer neuen Nutzerin – inklusive Offline-Phase, Neustart ohne Netz
 * und gemeinsamer Liste mit einem zweiten Konto auf einem anderen Gerät.
 */

test.afterAll(closeDb);

function trackErrors(page: Page) {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
        if (m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(`console: ${m.text()}`);
    });
    return errors;
}

/** Automatische Barrierefreiheits-Prüfung (WCAG 2.1 AA): schwere Verstöße lassen den Test scheitern. */
async function expectAccessible(page: Page, where: string) {
    await page.waitForTimeout(400); // Animationen abwarten
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${where}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
    expect(serious).toEqual([]);
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("button", { name, exact: true }).click();

const isoDaysAgo = (days: number) => {
    const d = new Date(Date.now() - days * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("Haushalt einrichten, offline weiterarbeiten, gemeinsam nutzen", async ({ page, context, browser }) => {
    const errors = trackErrors(page);

    await test.step("Registrieren und ersten Haushalt anlegen", async () => {
        await page.goto("/");
        await expectAccessible(page, "Anmeldung");
        await page.getByRole("button", { name: "Neu hier? Registrieren" }).click();
        await page.getByLabel("E-Mail-Adresse").fill("moritz@example.com");
        const passwords = page.locator('input[autocomplete="new-password"]');
        await passwords.nth(0).fill("sicheres-passwort");
        await passwords.nth(1).fill("sicheres-passwort");
        await page.getByRole("button", { name: "Konto erstellen" }).click();
        await expect(page.getByText("Lege deinen ersten Haushalt an")).toBeVisible();
        await page.getByRole("button", { name: "Anlegen" }).click();
        await expect(page.getByText("Willkommen!")).toBeVisible();
        expect((await q<{ name: string }>("select name from households"))[0].name).toBe("Zuhause");
    });

    await test.step("Gaszähler mit Kosten anlegen und zwei Stände eintragen", async () => {
        await page.getByRole("main").getByRole("button", { name: "Zähler", exact: true }).click(); // Schnellstart auf der Übersicht
        await page.getByRole("radio", { name: "Gas" }).click();
        await page.getByRole("button", { name: "Kosten & Abrechnung (optional)" }).click();
        await page.locator("#new-meter-payment").fill("120");
        await page.getByRole("radio", { name: "€/kWh" }).click();
        await page.locator("#new-meter-price").fill("0,11");
        await page.locator("#new-meter-fee").fill("15");
        await page.locator("#new-meter-z").fill("0,9512");
        await page.locator("#new-meter-cv").fill("11,2");
        await page.getByRole("button", { name: "Erstellen" }).click();

        await page.getByLabel(/Zählerstand/).fill("2000,5");
        await page.locator("#reading-date").fill(isoDaysAgo(60));
        await page.getByRole("button", { name: "Speichern" }).click();
        await expect(page.getByText("Zweite Ablesung nötig")).toBeVisible();

        // absichtlich sofort, während der vorige Dialog noch ausblendet
        await page.getByRole("button", { name: "Eintragen", exact: true }).click();
        await page.getByLabel(/Zählerstand/).fill("2180");
        await page.getByRole("button", { name: "Speichern" }).click();
        await expect(page.getByText("m³/Tag")).toBeVisible();
        await expect.poll(() => count("readings")).toBe(2);
    });

    await test.step("Tippfehler wird vor dem Speichern bemerkt", async () => {
        await page.getByRole("button", { name: "Eintragen", exact: true }).click();
        await page.getByLabel(/Zählerstand/).fill("21800");
        await page.getByRole("button", { name: "Speichern" }).click();
        await expect(page.getByText("Stimmt der Wert?")).toBeVisible();
        await page.keyboard.press("Escape");
        expect(await count("readings")).toBe(2);
    });

    await test.step("Statistik zeigt Verbrauch und Prognose", async () => {
        await page.getByRole("button", { name: "Statistik & Einstellungen" }).click();
        await expect(page.getByText("Ø pro Tag (30 Tage)")).toBeVisible();
        await expect(page.getByText("Kosten (Prognose)")).toBeVisible();
        await expectAccessible(page, "Zähler-Details");
        await page.keyboard.press("Escape");
    });

    await test.step("Einkaufsliste anlegen und abhaken", async () => {
        await nav(page, "Listen");
        await page.getByRole("button", { name: "Liste hinzufügen" }).click();
        await expect(page.getByLabel("Name der Liste")).toBeFocused();
        await page.keyboard.type("Einkauf");
        for (const item of ["Milch", "Brot", "Kaffee"]) {
            await page.getByLabel("Neuer Punkt").fill(item);
            await page.keyboard.press("Enter");
        }
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator("li")).toHaveCount(3);
        await page.waitForTimeout(500); // Sheet wächst nach oben – erst klicken, wenn es steht
        await dialog.getByRole("button", { name: "Brot", exact: true }).click();
        await page.getByRole("button", { name: "Fertig" }).click();
        await expect.poll(() => count("todo_items", "completed")).toBe(1);
        expect((await q<{ content: string }>("select content from todo_items where completed"))[0].content).toBe("Brot");
        expect((await q<{ name: string }>("select name from todo_lists"))[0].name).toBe("Einkauf");
    });

    await test.step("Offline eine Notiz schreiben", async () => {
        await context.setOffline(true);
        await nav(page, "Notizen");
        await page.getByRole("button", { name: "Notiz hinzufügen" }).click();
        await expect(page.locator("#note-title")).toBeFocused();
        await page.keyboard.type("Offline geschrieben");
        await page.locator("#note-content").fill("Funktioniert auch im Funkloch.");
        await page.waitForTimeout(1000);
        await page.getByRole("button", { name: "Fertig" }).click();
        await expect(page.getByRole("status")).toContainText("Offline");
        expect(await count("notes")).toBe(0);
    });

    await test.step("App startet ohne Netz aus dem Service Worker", async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByText("Offline geschrieben")).toBeVisible();
    });

    await test.step("Wieder online: alles wird synchronisiert", async () => {
        await context.setOffline(false);
        await expect.poll(() => count("notes"), { timeout: 30_000 }).toBe(1);
        expect((await q<{ content: string }>("select content from notes"))[0].content).toContain("Funkloch");
    });

    await test.step("Liste an die Übersicht heften, Dunkelmodus, Profil", async () => {
        await nav(page, "Listen");
        await page.getByRole("button", { name: "Einkauf an die Übersicht heften" }).click();
        await nav(page, "Übersicht");
        await expect(page.getByRole("heading", { name: "Einkauf" })).toBeVisible();
        await expectAccessible(page, "Übersicht hell");
        await page.getByRole("button", { name: "Dunkelmodus aktivieren" }).click();
        await expect(page.locator("html")).toHaveClass(/dark/);
        await expectAccessible(page, "Übersicht dunkel");
        await nav(page, "Profil");
        await expect(page.getByText("Ablese-Erinnerung")).toBeVisible();
        await expectAccessible(page, "Profil");
    });

    let inviteLink = "";
    await test.step("Partnerin einladen", async () => {
        await page.locator("header button[data-household-toggle]").click();
        await page.getByRole("button", { name: "Zuhause: Mitglieder & Einstellungen" }).click();
        await page.locator("#invite-email").fill("partnerin@example.com");
        await page.getByRole("button", { name: "Einladen" }).click();
        const link = page.locator("span.truncate.font-mono");
        await expect(link).toContainText("/invite/");
        inviteLink = (await link.textContent()) ?? "";
        await page.keyboard.press("Escape");
    });

    const partnerContext = await browser.newContext({ ...devices["Pixel 7"], locale: "de-DE", timezoneId: "Europe/Berlin" });
    const partner = await partnerContext.newPage();
    const partnerErrors = trackErrors(partner);

    await test.step("Zweites Gerät: Konto über die Einladung anlegen", async () => {
        await partner.goto(inviteLink);
        await expect(partner.getByText("eingeladen")).toBeVisible();
        const passwords = partner.locator('input[autocomplete="new-password"]');
        await passwords.nth(0).fill("partnerin-passwort");
        await passwords.nth(1).fill("partnerin-passwort");
        await partner.getByRole("button", { name: "Konto erstellen" }).click();
        await expect(partner.locator("header")).toContainText("Zuhause");
        await nav(partner, "Listen");
        await expect(partner.getByRole("heading", { name: "Einkauf" })).toBeVisible();
    });

    await test.step("Was die Partnerin abhakt, kommt beim anderen Gerät an", async () => {
        await partner.getByRole("button", { name: "Milch", exact: true, pressed: false }).click();
        await expect.poll(() => count("todo_items", "completed")).toBe(2);
        await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        await nav(page, "Listen");
        await expect(page.getByRole("button", { name: "Milch", exact: true, pressed: true })).toBeVisible({ timeout: 30_000 });
    });

    await test.step("Leere neue Notiz wird beim Schließen verworfen", async () => {
        await nav(page, "Notizen");
        await page.getByRole("button", { name: "Notiz hinzufügen" }).click();
        await expect(page.locator("#note-title")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect.poll(() => count("notes", "deleted_at is null")).toBe(1);
    });

    await test.step("Nach dem Löschen bleibt die Seite scrollbar", async () => {
        await page.getByRole("heading", { name: "Offline geschrieben" }).click();
        await page.getByRole("button", { name: "Notiz löschen" }).click();
        await page.getByRole("dialog", { name: "Notiz löschen?" }).getByRole("button", { name: "Löschen" }).click();
        await expect(page.getByRole("heading", { name: "Offline geschrieben" })).toHaveCount(0);
        expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
        await expect.poll(() => count("notes", "deleted_at is null")).toBe(0);
    });

    await partnerContext.close();
    expect(errors).toEqual([]);
    expect(partnerErrors).toEqual([]);
});
