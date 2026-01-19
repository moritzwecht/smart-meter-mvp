/* ============================================================================
   TOGGLE COMPONENT
   ============================================================================

   Visueller Toggle-Switch für Boolean-States (Ein/Aus, An/Aus, etc.).
   Perfekt für Settings wie Dark Mode, Benachrichtigungen, etc.

   Props:
   - checked: boolean - Aktueller State (ein/aus)
   - onChange: (checked: boolean) => void - Callback bei Änderung
   - label: string - Optionales Label neben dem Toggle
   - icon: ReactNode - Optionales Icon vor dem Label
   - disabled: boolean - Deaktiviert den Toggle
   - className: string - Zusätzliche CSS-Klassen
   - size: 'sm' | 'md' | 'lg' - Größe des Toggles

   Verwendung:
   ```tsx
   <Toggle
     checked={darkMode}
     onChange={setDarkMode}
     label="Dunkler Modus"
     icon={<Moon className="w-4 h-4" />}
   />

   <Toggle
     checked={notifications}
     onChange={setNotifications}
     label="Benachrichtigungen"
     size="sm"
   />
   ```

   Die Komponente bietet smooth Animationen und ist vollständig accessible.
============================================================================ */

"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

/**
 * Toggle-Größen
 * - sm: Klein (z.B. in Listen)
 * - md: Mittel (Standard)
 * - lg: Groß (z.B. prominente Settings)
 */
export type ToggleSize = "sm" | "md" | "lg";

export interface ToggleProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  /** Aktueller State (ein/aus) */
  checked: boolean;

  /** Callback bei State-Änderung */
  onChange: (checked: boolean) => void;

  /** Optionales Label neben dem Toggle */
  label?: string;

  /** Optionales Icon vor dem Label */
  icon?: React.ReactNode;

  /** Größe des Toggle-Switches */
  size?: ToggleSize;

  /** CSS-Klasse für den Container */
  containerClassName?: string;
}

/* ============================================================================
   COMPONENT
============================================================================ */

/**
 * Toggle-Switch-Komponente mit forwardRef.
 * Accessible und animiert.
 */
export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      checked,
      onChange,
      label,
      icon,
      size = "md",
      disabled,
      className,
      containerClassName,
      ...props
    },
    ref
  ) => {
    /* Size Variants
       ========================================================================
       Definiert Größen für Track (Hintergrund) und Thumb (Kreis) */
    const sizeConfig = {
      sm: {
        track: "w-10 h-6",
        thumb: "w-4 h-4",
        translate: "translate-x-5",
      },
      md: {
        track: "w-14 h-8",
        thumb: "w-6 h-6",
        translate: "translate-x-7",
      },
      lg: {
        track: "w-16 h-10",
        thumb: "w-8 h-8",
        translate: "translate-x-7",
      },
    };

    const config = sizeConfig[size];

    return (
      <label
        className={cn(
          "flex items-center justify-between cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          containerClassName
        )}
      >
        {/* Label + Icon (links)
            ====================================================================
            Optionaler Text und Icon vor dem Toggle */}
        {(label || icon) && (
          <div className="flex items-center gap-3">
            {icon && <div className="text-muted-foreground">{icon}</div>}
            {label && <span className="text-sm font-medium">{label}</span>}
          </div>
        )}

        {/* Toggle Switch
            ====================================================================
            Versteckter Checkbox-Input + Custom Visual */}
        <div className="relative">
          {/* Hidden Checkbox
              ==================================================================
              Native Input für Accessibility (Screen Reader, Keyboard Nav) */}
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="sr-only" // Screen-reader only (visuell versteckt)
            {...props}
          />

          {/* Visual Track
              ==================================================================
              Hintergrund des Toggle (die "Schiene") */}
          <div
            className={cn(
              "rounded-full transition-colors",
              config.track,
              checked ? "bg-primary" : "bg-border",
              disabled && "cursor-not-allowed",
              className
            )}
          >
            {/* Visual Thumb
                ================================================================
                Kreis der sich bewegt (der "Schalter") */}
            <div
              className={cn(
                "absolute top-1 left-1 rounded-full bg-white transition-transform",
                config.thumb,
                checked && config.translate
              )}
            />
          </div>
        </div>
      </label>
    );
  }
);

/* Display Name für besseres Debugging in React DevTools */
Toggle.displayName = "Toggle";
