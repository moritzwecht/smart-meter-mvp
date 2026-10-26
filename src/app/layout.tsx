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
        statusBarStyle: "black-translucent",
        title: "My Home",
    },
    formatDetection: { telephone: false },
    icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
    themeColor: "#f8fafc",
    width: "device-width",
    initialScale: 1,
    // Verhindert das automatische Hineinzoomen in Eingabefelder auf iOS
    // (Pinch-Zoom bleibt in Safari trotzdem möglich).
    maximumScale: 1,
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
