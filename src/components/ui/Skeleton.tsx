/* ============================================================================
   SKELETON COMPONENT
   ============================================================================

   Loading-Placeholder für Inhalte während Daten geladen werden.
   Zeigt eine animierte Grau-Fläche die "pulsiert".

   Features:
   - Pulsing Animation (Tailwind animate-pulse)
   - Flexible Größe durch className
   - Nutzt muted-Farben aus dem Design-System
   - Funktioniert in Light & Dark Mode

   Props:
   - className: string - Definiert Größe/Form des Skeletons
   - ...props: Alle HTML-div-Attribute

   Verwendung:
   ```tsx
   // Skeleton für Text-Zeile
   <Skeleton className="h-4 w-32" />

   // Skeleton für Avatar
   <Skeleton className="w-12 h-12 rounded-full" />

   // Skeleton für Card
   <Skeleton className="h-48 w-full rounded-2xl" />
   ```

   Best Practice:
   - Skeleton sollte die gleiche Größe/Form wie der finale Inhalt haben
   - Bei mehreren Skeletons: space-y für vertikale Abstände nutzen
============================================================================ */

"use client";

import { cn } from "@/lib/utils";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    /** className für Größe, Form und Position (z.B. "h-4 w-32 rounded-md") */
}

/* ============================================================================
   COMPONENT
============================================================================ */

/**
 * Skeleton-Komponente für Loading-States.
 * Zeigt animierten Placeholder während Inhalte laden.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                /* Basis-Styles
                   ================================================================
                   animate-pulse: Tailwind-Animation (fade in/out)
                   rounded-md: Leicht abgerundete Ecken
                   bg-muted/50: Halbdurchsichtige muted-Farbe */
                "animate-pulse rounded-md bg-muted/50",
                className
            )}
            {...props}
        />
    );
}
