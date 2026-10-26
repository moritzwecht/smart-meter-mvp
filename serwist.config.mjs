// @ts-check
import { serwist } from "@serwist/next/config";

/*
 * Baut den Service Worker nach `next build` (Script `build`: `next build && serwist build`).
 * Turbopack unterstützt das Serwist-Webpack-Plugin nicht – bisher entstand dadurch
 * gar kein Service Worker und die App war offline nicht startbar.
 */
export default serwist({
    swSrc: "src/sw.ts",
    swDest: "public/sw.js",
    // Die Startseite ist statisch vorgerendert und wird mit vorgeladen → Offline-Start.
    precachePrerendered: true,
    // Standard + Schriften, damit die App offline auch typografisch identisch aussieht
    globPatterns: [".next/static/**/*.{js,css,html,ico,png,svg,webp,json,woff,woff2}", "public/**/*"],
});
