import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { AppProviders } from "@/components/app/AppProviders";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
    title: "My Home",
    description: "Zählerstände, Listen und Notizen für deinen Haushalt – auch offline.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        // "default": iOS färbt die Statusleiste passend zu theme-color (lesbar in Hell und Dunkel)
        statusBarStyle: "default",
        title: "My Home",
    },
    formatDetection: { telephone: false },
    icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
        { media: "(prefers-color-scheme: dark)", color: "#020617" },
    ],
    width: "device-width",
    initialScale: 1,
    // Kein maximumScale: Zoomen bleibt möglich (Barrierefreiheit). Das automatische
    // Hineinzoomen von iOS in Eingabefelder verhindern 16px große Eingabefelder.
    viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="de" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className="antialiased">
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
