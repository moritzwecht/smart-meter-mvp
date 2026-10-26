"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Hell/Dunkel-Modus. Das Inline-Skript im Layout setzt die Klasse schon vor dem
 * ersten Rendern – kein kurzes Aufblitzen des falschen Themes mehr.
 */

export type Theme = "light" | "dark";
const STORAGE_KEY = "theme";

export const themeInitScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.classList.add("dark")}document.documentElement.style.colorScheme=t}catch(e){}})();`;

const listeners = new Set<() => void>();

function current(): Theme {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* privater Modus o. Ä. */
    }
    syncThemeColor();
    listeners.forEach((l) => l());
}

/** Statusleiste/Browser-UI an das gewählte Theme anpassen (überschreibt die Systemvorgabe). */
export function syncThemeColor() {
    const color = current() === "dark" ? "#020617" : "#f8fafc";
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
        meta.content = color;
    });
}

export function useTheme() {
    const theme = useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        current,
        () => "light" as Theme,
    );
    const toggle = useCallback(() => setTheme(current() === "dark" ? "light" : "dark"), []);
    return { theme, setTheme, toggle };
}
