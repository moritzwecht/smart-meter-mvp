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
            matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
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
