"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gestrichelte Kachel zum Anlegen (Liste, Notiz, Zähler). */
export function AddTile({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[140px]",
                className,
            )}
        >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                {label}
            </span>
        </button>
    );
}

export function FieldLabel({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
    return (
        <label htmlFor={htmlFor} className={cn("block text-[10px] font-bold uppercase tracking-widest text-muted-foreground", className)}>
            {children}
        </label>
    );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
    return (
        <div className="py-20 px-6 text-center border-2 border-dashed border-foreground/5 rounded-3xl">
            <div className="text-sm text-muted-foreground space-y-3">{children}</div>
        </div>
    );
}
