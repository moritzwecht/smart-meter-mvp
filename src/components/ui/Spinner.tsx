/* ============================================================================
   SPINNER COMPONENT
   ============================================================================

   Animierter Loading-Spinner für aktive Lade-Vorgänge.
   Nutzt Lucide's Loader2-Icon mit Rotation-Animation.

   Features:
   - Smooth Rotation-Animation (Tailwind animate-spin)
   - Konfigurierbare Größe
   - Nutzt muted-foreground für subtilen Look
   - Funktioniert in Light & Dark Mode

   Props:
   - size: number - Größe in Pixel (default: 16)
   - className: string - Zusätzliche CSS-Klassen
   - ...props: Alle SVG-Attribute

   Verwendung:
   ```tsx
   // Standard Spinner
   <Spinner />

   // Großer Spinner
   <Spinner size={24} />

   // Custom-Color Spinner
   <Spinner className="text-primary" />

   // In Button
   <Button disabled={loading}>
     {loading ? <Spinner size={16} /> : "Speichern"}
   </Button>
   ```

   Best Practice:
   - Für inline-Spinner in Buttons: size={16} oder kleiner
   - Für standalone-Spinner: size={24-32}
   - Immer mit disabled-State kombinieren bei Buttons
============================================================================ */

"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

interface SpinnerProps extends React.HTMLAttributes<SVGElement> {
    /** Größe des Spinners in Pixel (default: 16) */
    size?: number;
}

/* ============================================================================
   COMPONENT
============================================================================ */

/**
 * Spinner-Komponente für Loading-States.
 * Zeigt rotierende Loader-Icon während Prozesse laufen.
 */
export function Spinner({ className, size = 16, ...props }: SpinnerProps) {
    return (
        <Loader2
            className={cn(
                /* Basis-Styles
                   ================================================================
                   animate-spin: Tailwind-Animation (360° rotation)
                   text-muted-foreground: Subtile Farbe */
                "animate-spin text-muted-foreground",
                className
            )}
            size={size}
            {...props}
        />
    );
}
