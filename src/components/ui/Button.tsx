/* ============================================================================
   BUTTON COMPONENT
   ============================================================================

   Wiederverwendbarer Button mit verschiedenen Varianten und States.

   Props:
   - variant: 'primary' | 'ghost' | 'danger' - Visuelle Variante
   - disabled: boolean - Deaktiviert den Button
   - children: ReactNode - Button-Inhalt (Text, Icons, etc.)
   - className: string - Zusätzliche CSS-Klassen
   - ...props: Alle weiteren HTML-Button-Attribute

   Verwendung:
   ```tsx
   <Button variant="primary" onClick={handleClick}>
     <Save className="w-4 h-4" />
     Speichern
   </Button>
   ```

   Die Komponente nutzt die .btn-Klassen aus globals.css und erweitert diese
   mit React-Props für maximale Flexibilität.
============================================================================ */

"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

/**
 * Button-Varianten entsprechend dem Design-System
 * - primary: Haupt-Aktionen (Speichern, Bestätigen)
 * - ghost: Sekundäre Aktionen ohne starken visuellen Fokus
 * - danger: Destruktive Aktionen (Löschen, Abmelden)
 */
export type ButtonVariant = "primary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

/* ============================================================================
   COMPONENT
============================================================================ */

/**
 * Button-Komponente mit forwardRef für Ref-Zugriff auf das DOM-Element.
 * Nützlich für Focus-Management und externe Bibliotheken.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, children, disabled, ...props }, ref) => {
    /* CSS-Klassen basierend auf Variante
       ========================================================================
       cn(): Utility-Funktion die Klassen merged und Konflikte auflöst
       - btn: Basis-Klasse (immer)
       - btn-{variant}: Varianten-Klasse (primary, ghost, danger)
       - className: Custom-Klassen vom Nutzer */
    const variantClasses = {
      primary: "btn-primary",
      ghost: "btn-ghost",
      danger: "btn-danger",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "btn", // Basis-Button-Styles
          variantClasses[variant], // Varianten-spezifische Styles
          className // Custom Overrides
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

/* Display Name für besseres Debugging in React DevTools */
Button.displayName = "Button";
