import type { CapacitorConfig } from "@capacitor/cli";

/*
 * Die nativen Apps laden die Web-App von home.moritz-wecht.de.
 * iOS: Service Worker (und damit der Offline-Start) funktionieren im WKWebView nur
 * für "App-Bound Domains" – daher `limitsNavigationsToAppBoundDomains` plus
 * WKAppBoundDomains in ios/App/App/Info.plist.
 * Nach Änderungen: `npx cap sync`.
 */
const config: CapacitorConfig = {
    appId: "de.moritzwecht.home",
    appName: "My Home",
    webDir: "public",
    server: {
        url: "https://home.moritz-wecht.de",
        cleartext: false,
    },
    ios: {
        limitsNavigationsToAppBoundDomains: true,
        contentInset: "never",
    },
    android: {
        allowMixedContent: false,
    },
};

export default config;
