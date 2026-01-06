# Smart Meter MVP - Styling Guide

Willkommen im Styling-Guide für unser Smart Meter MVP. Dieses Projekt nutzt **Tailwind CSS v4** in Kombination mit einer modernen Theming-Struktur basierend auf CSS-Variablen.

---

## 🚀 Tailwind CSS v4 Architektur

Im Gegensatz zu älteren Versionen wird Tailwind v4 direkt in CSS konfiguriert. Du findest die Hauptkonfiguration in:
`[src/app/globals.css](file:///c:/projects/smart-meter-mvp/src/app/globals.css)`

### Das @theme Block
Hier definieren wir unsere Design-Tokens (Farben, Fonts, Radien):

```css
@theme {
  --font-sans: "Inter", ...;
  --color-primary: var(--primary);
  --radius-lg: 1rem;
  /* ... */
}
```

---

## 🎨 Theming & Farben

Wir nutzen CSS-Variablen (`:root`), um zwischen Light- und Dark-Mode zu wechseln.

### Wie man Farben anpasst
Um die Grundfarben der App zu ändern, bearbeite die Werte im `:root` (Light Mode) oder `:root.dark` Block in der `globals.css`.

| Variable | Beschreibung |
| :--- | :--- |
| `--background` | Haupthintergrund der App |
| `--foreground` | Standard-Textfarbe |
| `--primary` | Akzentfarbe für Buttons und wichtige Elemente |
| `--card` | Hintergrundfarbe für Widgets/Karten |
| `--border` | Rahmenfarbe für Elemente |

> [!TIP]
> Benutze immer die Tailwind-Klassen wie `bg-primary` oder `text-muted-foreground`, anstatt feste Hex-Codes in deine Komponenten zu schreiben. So bleibt das Design konsistent.

---

## 🌓 Light & Dark Mode

Die Umschaltung erfolgt über die Klasse `.dark` am `<html>` Element.

- **In CSS:** Nutze `:root.dark { ... }` für Variablen.
- **In Tailwind Klassen:** Tailwind v4 erkennt den Dark Mode automatisch über die Variablen. Wenn du spezifische Änderungen brauchst, nutze den Prefix `dark:`, z.B. `bg-white dark:bg-black`.

---

## 🧩 Wiederverwendbare Komponenten

Wir haben globale CSS-Klassen für häufig genutzte Elemente definiert. Nutze diese, um ein einheitliches Look & Feel zu gewährleisten:

### 1. Buttons (`.btn`)
- `.btn-primary`: Der Haupt-Action-Button (dunkel/hell je nach Theme).
- `.btn-ghost`: Ein subtiler Button ohne Hintergrund, der erst beim Hover erscheint.

*Beispiel:*
```tsx
<button className="btn btn-primary">Klicken</button>
```

### 2. Karten & Widgets (`.card`)
Die Klasse `.card` bietet standardmäßig abgerundete Ecken, einen Rahmen und einen eleganten Hover-Effekt (leichtes Anheben und Schatten).

### 3. Eingabefelder (`.input-field`)
Standardisiertes Styling für Formularfelder mit Fokus-Effekten.

### 4. Glassmorphism (`.glass`)
Erzeugt einen halbtransparenten "Milchglas"-Effekt mit Blur. Ideal für Overlays oder Navigationen.

---

## 📱 Responsives Design

Wir nutzen die Standard-Tailwind-Breakpoints:
- `sm:` (640px)
- `md:` (768px)
- `lg:` (1024px)
- `xl:` (1280px)

*Beispiel:* `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` sorgt für ein Layout, das auf dem Handy einspaltig und auf dem Desktop dreispaltig ist.

---

## 💡 Best Practices

1. **Vermeide Inline-Styles**: Nutze Tailwind-Klassen.
2. **Nutze Framer Motion**: Für Animationen nutzen wir `framer-motion`. Siehe Beispiele in der `page.tsx` für Einblend-Effekte.
3. **Icons**: Wir nutzen `lucide-react`. Konsistente Icon-Größen sind meist `w-4 h-4` oder `w-5 h-5`.
4. **Spacing**: Nutze das Tailwind-Grid (8px Schritte). `p-4` entspricht 16px, `p-8` entspricht 32px.
