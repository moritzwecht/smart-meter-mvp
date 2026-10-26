"use client";

import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pinnnadel für Karten. Sichtbar klein, aber mit 44 × 44 px Tippfläche
 * (negativer Rand, damit das Layout gleich bleibt).
 */
export function PinButton({ pinned, name, onToggle, large = false }: { pinned: boolean; name: string; onToggle: () => void; large?: boolean }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={pinned}
            aria-label={`${name} an die Übersicht heften`}
            className="group shrink-0 w-11 h-11 -m-2 flex items-center justify-center rounded-xl"
        >
            <span
                className={cn(
                    "flex items-center justify-center transition-colors",
                    large ? "w-8 h-8 rounded-xl" : "w-7 h-7 rounded-lg",
                    pinned ? "text-primary bg-primary/10" : "text-muted-foreground/40 group-hover:text-primary group-hover:bg-primary/5",
                )}
            >
                <Pin className={cn(large ? "w-4 h-4" : "w-3.5 h-3.5", pinned && "fill-current")} />
            </span>
        </button>
    );
}
