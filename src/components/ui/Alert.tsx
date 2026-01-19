/* ============================================================================
   ALERT COMPONENT
   ============================================================================

   Komponente für Benachrichtigungen, Fehler und Erfolgsmeldungen.
   Bietet konsistentes Styling für verschiedene Message-Typen.

   Props:
   - variant: 'info' | 'success' | 'warning' | 'error' - Alert-Typ
   - title: string - Optionaler Titel
   - children: ReactNode - Alert-Inhalt/Nachricht
   - icon: ReactNode - Optionales Custom-Icon
   - className: string - Zusätzliche CSS-Klassen
   - onClose: () => void - Optional: Macht Alert dismissable

   Verwendung:
   ```tsx
   <Alert variant="success">
     Erfolgreich gespeichert!
   </Alert>

   <Alert variant="error" title="Fehler">
     Passwort ist zu kurz
   </Alert>

   <Alert variant="info" onClose={() => setShow(false)}>
     Dies ist ein wichtiger Hinweis
   </Alert>
   ```

   Die Komponente passt Farben und Styling automatisch an die Variante an
   und unterstützt sowohl Light als auch Dark Mode.
============================================================================ */

"use client";

import { HTMLAttributes } from "react";
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

/**
 * Alert-Varianten für verschiedene Nachrichtentypen
 * - info: Informative Nachrichten (blau)
 * - success: Erfolgs-Nachrichten (grün)
 * - warning: Warnungen (gelb/orange)
 * - error: Fehler (rot)
 */
export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  /** Visuelle Variante des Alerts */
  variant?: AlertVariant;

  /** Optionaler Titel über der Nachricht */
  title?: string;

  /** Alert-Inhalt */
  children: React.ReactNode;

  /** Custom Icon (überschreibt Standard-Icon) */
  icon?: React.ReactNode;

  /** Callback zum Schließen (macht Alert dismissable) */
  onClose?: () => void;
}

/* ============================================================================
   COMPONENT
============================================================================ */

/**
 * Alert-Komponente für verschiedene Nachrichtentypen.
 * Automatisches Styling basierend auf Variante.
 */
export function Alert({
  variant = "info",
  title,
  children,
  icon,
  onClose,
  className,
  ...props
}: AlertProps) {
  /* CSS-Klassen und Icons basierend auf Variante
     ==========================================================================
     Jede Variante hat eigene Farben für:
     - Hintergrund (bg)
     - Border
     - Text
     - Icon */
  const variantConfig = {
    info: {
      container:
        "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50",
      text: "text-blue-600 dark:text-blue-400",
      icon: <Info className="w-4 h-4" />,
    },
    success: {
      container:
        "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle className="w-4 h-4" />,
    },
    warning: {
      container:
        "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50",
      text: "text-amber-600 dark:text-amber-400",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    error: {
      container:
        "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50",
      text: "text-red-600 dark:text-red-400",
      icon: <AlertCircle className="w-4 h-4" />,
    },
  };

  const config = variantConfig[variant];

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border-2 p-4", // Basis-Layout
        config.container, // Varianten-spezifische Farben
        className
      )}
      {...props}
    >
      <div className="flex gap-3">
        {/* Icon
            ====================================================================
            Standard-Icon basierend auf Variante oder Custom-Icon */}
        <div className={cn("shrink-0 mt-0.5", config.text)}>
          {icon || config.icon}
        </div>

        {/* Content
            ====================================================================
            Titel + Nachricht */}
        <div className="flex-1 space-y-1">
          {title && (
            <h4 className={cn("text-sm font-bold", config.text)}>{title}</h4>
          )}
          <div className={cn("text-sm font-medium", config.text)}>
            {children}
          </div>
        </div>

        {/* Close Button (optional)
            ====================================================================
            Nur angezeigt wenn onClose-Callback übergeben wurde */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
              config.text
            )}
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
