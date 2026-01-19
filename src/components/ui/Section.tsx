/* ============================================================================
   SECTION COMPONENT
   ============================================================================

   Container-Komponente für thematisch gruppierte Inhalte in Settings-Screens.
   Bietet konsistente Abstände, Header mit Icons und optionale Beschreibungen.

   Props:
   - title: string - Sektions-Titel (z.B. "Account", "Sicherheit")
   - icon: ReactNode - Icon neben dem Titel
   - description: string - Optionale Beschreibung unter dem Titel
   - variant: 'default' | 'danger' - Visuelle Variante (danger für kritische Bereiche)
   - children: ReactNode - Inhalt der Sektion
   - className: string - Zusätzliche CSS-Klassen

   Verwendung:
   ```tsx
   <Section
     title="Account"
     icon={<User className="w-3.5 h-3.5" />}
     description="Verwalte deine Account-Einstellungen"
   >
     <Input label="Name" value={name} onChange={...} />
   </Section>

   <Section
     title="Gefahrenzone"
     icon={<AlertTriangle className="w-3.5 h-3.5" />}
     variant="danger"
   >
     <Button variant="danger">Account löschen</Button>
   </Section>
   ```

   Diese Komponente sorgt für visuelle Konsistenz und reduziert Wiederholungen
   in Settings-Screens.
============================================================================ */

"use client";

import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

/**
 * Section-Varianten für verschiedene Kontexte
 * - default: Normale Sektion (grau/neutral)
 * - danger: Kritische Sektion (rot) für destruktive Aktionen
 */
export type SectionVariant = "default" | "danger";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Titel der Sektion */
  title: string;

  /** Icon neben dem Titel (z.B. Lucide Icons) */
  icon?: React.ReactNode;

  /** Optionale Beschreibung unter dem Titel */
  description?: string;

  /** Visuelle Variante der Sektion */
  variant?: SectionVariant;

  /** Inhalt der Sektion */
  children: React.ReactNode;
}

/* ============================================================================
   COMPONENT
============================================================================ */

/**
 * Section-Komponente für gruppierte Settings-Bereiche.
 * Bietet konsistentes Layout mit Header, Icon und Content.
 */
export function Section({
  title,
  icon,
  description,
  variant = "default",
  children,
  className,
  ...props
}: SectionProps) {
  /* CSS-Klassen basierend auf Variante
     ==========================================================================
     default: Neutrale Farben (opacity-40 für subtilen Look)
     danger: Rote Farben für destruktive Bereiche */
  const variantClasses = {
    default: "opacity-40",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <section
      className={cn(
        "space-y-4", // Vertikaler Abstand zwischen Header und Content
        variant === "danger" && "pt-8 border-t-2 border-border/50", // Danger-Sections haben Top-Border
        className
      )}
      {...props}
    >
      {/* Section Header
          ======================================================================
          Enthält Titel, Icon und optionale Beschreibung */}
      <div className="space-y-2">
        {/* Titel + Icon
            ==================================================================
            Uppercase, bold, klein - klassisches Settings-Pattern */}
        <h3
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest flex items-center gap-2",
            variantClasses[variant]
          )}
        >
          {icon && icon}
          {title}
        </h3>

        {/* Beschreibung (optional)
            ==================================================================
            Gibt dem Nutzer mehr Kontext zur Sektion */}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Section Content
          ======================================================================
          Hier kommt der eigentliche Inhalt (Inputs, Buttons, etc.) */}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
