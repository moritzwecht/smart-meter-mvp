import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

/*
 * Service Worker: hält die App-Shell (HTML, JS, CSS, Icons) offline verfügbar.
 * Daten kommen nie aus dem Cache – die liegen in IndexedDB und werden über
 * /api/sync abgeglichen. API-Antworten (Session, Sync) dürfen daher nie gecacht
 * werden, sonst sähe man z. B. nach dem Logout offline noch die alte Session.
 *
 * Gebaut wird er nach `next build` von `serwist build` (siehe serwist.config.mjs),
 * weil das Serwist-Webpack-Plugin mit Turbopack nicht läuft.
 */

declare global {
    interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        {
            // Einladungs- und Reset-Seiten enthalten persönliche Daten und Einmal-Tokens → nie cachen
            matcher: ({ sameOrigin, url }) => sameOrigin && /^\/(api|invite|reset)\//.test(url.pathname),
            handler: new NetworkOnly(),
        },
        ...defaultCache,
    ],
    fallbacks: {
        entries: [
            {
                url: "/",
                matcher: ({ request }) => request.destination === "document",
            },
        ],
    },
});

serwist.addEventListeners();

// Push-Benachrichtigungen (Ablese-Erinnerung) -------------------------------------------
// Minimale Typen, damit das Projekt nicht zusätzlich die "webworker"-Lib braucht
// (die kollidiert mit der DOM-Lib der restlichen App).

type WaitUntil = { waitUntil(promise: Promise<unknown>): void };
type PushEvt = WaitUntil & { data: { json(): unknown; text(): string } | null };
type ClickEvt = WaitUntil & { notification: Notification };
type WindowClientLike = { url: string; focus(): Promise<unknown>; navigate?(url: string): Promise<unknown> };

const worker = self as unknown as {
    registration: ServiceWorkerRegistration;
    location: Location;
    clients: {
        matchAll(options: { type: "window"; includeUncontrolled: boolean }): Promise<WindowClientLike[]>;
        openWindow(url: string): Promise<unknown>;
    };
    addEventListener(type: "push", listener: (event: PushEvt) => void): void;
    addEventListener(type: "notificationclick", listener: (event: ClickEvt) => void): void;
};

worker.addEventListener("push", (event) => {
    let data: { title?: string; body?: string; url?: string; tag?: string } = {};
    try {
        data = (event.data?.json() as typeof data) ?? {};
    } catch {
        data = { body: event.data?.text() };
    }
    event.waitUntil(
        worker.registration.showNotification(data.title ?? "My Home", {
            body: data.body,
            tag: data.tag,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: { url: data.url ?? "/" },
        }),
    );
});

worker.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = new URL((event.notification.data as { url?: string } | null)?.url ?? "/", worker.location.origin).href;
    event.waitUntil(
        (async () => {
            const clients = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
            const existing = clients.find((c) => new URL(c.url).origin === worker.location.origin);
            if (existing) {
                await existing.focus();
                await existing.navigate?.(target);
                return;
            }
            await worker.clients.openWindow(target);
        })(),
    );
});
