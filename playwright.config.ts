import { defineConfig, devices } from "@playwright/test";

/*
 * Browser-Ende-zu-Ende-Test gegen den Produktions-Build (inkl. Service Worker)
 * und eine echte Postgres-Datenbank.
 *
 *   E2E_DATABASE_URL=postgres://… npm run test:browser
 *
 * ACHTUNG: Die Datenbank wird vor dem Test geleert – nie die Produktions-URL nehmen.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/myhome_e2e";

export default defineConfig({
    testDir: "tests/browser",
    timeout: 90_000,
    expect: { timeout: 15_000 },
    // Ein Ablauf, der aufeinander aufbaut – nicht parallelisieren
    workers: 1,
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
    globalSetup: "./tests/browser/global-setup.ts",
    use: {
        ...devices["Pixel 7"],
        baseURL: `http://localhost:${PORT}`,
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            DATABASE_URL,
            AUTH_SECRET: "e2e-secret-0123456789-0123456789-abcdef",
            APP_URL: `http://localhost:${PORT}`,
            CRON_SECRET: "e2e-cron",
            // E-Mails (Anmeldecodes) landen im Test-Postfach aus tests/browser/mail-server.ts
            RESEND_API_KEY: "re_e2e_test",
            RESEND_BASE_URL: `http://127.0.0.1:${process.env.E2E_MAIL_PORT ?? 3199}`,
            EMAIL_FROM: "My Home <test@example.com>",
        },
    },
});
