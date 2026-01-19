/* ============================================================================
   INPUT COMPONENT
   ============================================================================

   Wiederverwendbares Eingabefeld mit optionaler Label und Icon-Unterstützung.
   Speziell für Password-Felder gibt es eine Toggle-Funktion zum Ein-/Ausblenden.

   Props:
   - label: string - Optionales Label über dem Input
   - type: 'text' | 'email' | 'password' | etc. - Input-Typ
   - showPasswordToggle: boolean - Zeigt Eye-Icon für Password-Fields
   - icon: ReactNode - Optionales Icon am Anfang des Inputs
   - error: string - Fehlermeldung (zeigt roten Border)
   - className: string - Zusätzliche CSS-Klassen
   - containerClassName: string - CSS für den umgebenden Container
   - ...props: Alle weiteren HTML-Input-Attribute

   Verwendung:
   ```tsx
   <Input
     label="E-Mail"
     type="email"
     placeholder="mail@example.com"
     value={email}
     onChange={(e) => setEmail(e.target.value)}
   />

   <Input
     label="Passwort"
     type="password"
     showPasswordToggle
     value={password}
     onChange={(e) => setPassword(e.target.value)}
   />
   ```
============================================================================ */

"use client";

import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optionales Label über dem Input-Feld */
  label?: string;

  /** Zeigt Password-Toggle-Button (nur bei type="password") */
  showPasswordToggle?: boolean;

  /** Optionales Icon am Anfang des Input-Feldes */
  icon?: React.ReactNode;

  /** Fehlermeldung - färbt Border rot und zeigt Text */
  error?: string;

  /** CSS-Klasse für den Container (umschließt Label + Input) */
  containerClassName?: string;
}

/* ============================================================================
   COMPONENT
============================================================================ */

/**
 * Input-Komponente mit forwardRef für direkten DOM-Zugriff.
 * Unterstützt Labels, Icons, Password-Toggle und Error-States.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      type = "text",
      showPasswordToggle = false,
      icon,
      error,
      className,
      containerClassName,
      ...props
    },
    ref
  ) => {
    /* ========================================================================
       STATE MANAGEMENT
       ========================================================================
       showPassword: Kontrolliert ob Password sichtbar ist (nur bei type="password")
    ======================================================================== */
    const [showPassword, setShowPassword] = useState(false);

    /* Bestimme den tatsächlichen Input-Typ
       ========================================================================
       Wenn showPasswordToggle aktiv ist und Password versteckt:
       - type="password" → zeigt Punkte (••••)
       Wenn Password sichtbar gemacht wurde:
       - type="text" → zeigt Klartext */
    const inputType =
      type === "password" && showPasswordToggle && showPassword
        ? "text"
        : type;

    return (
      <div className={cn("space-y-2", containerClassName)}>
        {/* Label (optional)
            ====================================================================
            Nur angezeigt wenn label-Prop übergeben wurde */}
        {label && (
          <label className="text-xs font-medium text-muted-foreground">
            {label}
          </label>
        )}

        {/* Input Container
            ====================================================================
            Wrapper für Input + Icons/Buttons */}
        <div className="relative">
          {/* Start-Icon (optional)
              ==================================================================
              Zeigt Icon am Anfang des Inputs (z.B. Mail-Icon) */}
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}

          {/* Input Field
              ==================================================================
              Haupt-Eingabefeld mit allen nativen HTML-Input-Funktionen */}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              "input-field w-full", // Basis-Klasse aus globals.css
              icon && "pl-10", // Mehr Padding wenn Icon vorhanden
              showPasswordToggle && "pr-12", // Mehr Padding für Toggle-Button
              error && "border-red-500 dark:border-red-400", // Roter Border bei Fehler
              className
            )}
            {...props}
          />

          {/* Password Toggle Button (optional)
              ==================================================================
              Nur bei type="password" und showPasswordToggle={true} */}
          {type === "password" && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Passwort verstecken" : "Passwort anzeigen"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Error Message (optional)
            ====================================================================
            Zeigt Fehlermeldung unter dem Input */}
        {error && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

/* Display Name für besseres Debugging in React DevTools */
Input.displayName = "Input";
