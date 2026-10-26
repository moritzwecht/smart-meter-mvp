"use client";

import { AlertTriangle, CloudOff, RefreshCcw } from "lucide-react";
import { usePendingCount, useSyncState } from "@/lib/offline/hooks";
import { requestSync } from "@/lib/offline/sync-engine";

/** Kleiner Statushinweis unter dem Haushaltsnamen: offline / ausstehend / Fehler. */
export function SyncIndicator() {
    const { status } = useSyncState();
    const pending = usePendingCount();

    if (status === "offline") {
        return (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500" role="status">
                <CloudOff className="w-3 h-3" />
                Offline{pending > 0 && ` · ${pending} ausstehend`}
            </span>
        );
    }
    if (status === "error") {
        return (
            <button
                type="button"
                onClick={() => requestSync({ immediate: true })}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600"
                role="status"
            >
                <AlertTriangle className="w-3 h-3" />
                Sync fehlgeschlagen · erneut versuchen
            </button>
        );
    }
    if (pending > 0 || status === "syncing") {
        return (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" role="status">
                <RefreshCcw className="w-3 h-3 animate-spin" />
                {pending > 0 ? `Synchronisiere ${pending} …` : "Synchronisiere …"}
            </span>
        );
    }
    return null;
}
