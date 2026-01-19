# UI Component Library

Wiederverwendbare UI-Komponenten für die Smart Meter MVP App.
Alle Komponenten folgen Tailwind CSS Best Practices und sind vollständig kommentiert.

## 📦 Komponenten-Übersicht

### Layout & Container

#### `<BaseDialog>` - Modal/Dialog
Vollständig responsive Dialog-Komponente mit Mobile-Optimierung.

```tsx
<BaseDialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Titel"
  footer={<Button>Speichern</Button>}
>
  <p>Dialog-Inhalt</p>
</BaseDialog>
```

**Features:**
- Mobile: Slide-up Animation von unten
- Desktop: Fade-in in der Mitte
- Auto-Anpassung an Mobile-Keyboard
- ESC zum Schließen

---

#### `<Section>` - Settings-Sektion
Container für gruppierte Settings mit Titel und Icon.

```tsx
<Section
  title="Account"
  icon={<User className="w-3.5 h-3.5" />}
  variant="default"
>
  <Input label="Name" value={name} onChange={...} />
</Section>
```

**Props:**
- `variant`: `"default"` | `"danger"` - Für normale oder kritische Sektionen

---

### Form Elements

#### `<Input>` - Text-Eingabefeld
Input-Komponente mit Label, Icons und Password-Toggle.

```tsx
<Input
  label="E-Mail"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="mail@example.com"
/>

<Input
  label="Passwort"
  type="password"
  showPasswordToggle
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
```

**Features:**
- Optionales Label
- Password-Toggle (Eye/EyeOff Icon)
- Error-States mit rotem Border
- Icon-Support

---

#### `<Button>` - Action-Button
Button mit verschiedenen Varianten.

```tsx
<Button variant="primary" onClick={handleSave}>
  <Save className="w-4 h-4" />
  Speichern
</Button>

<Button variant="danger" onClick={handleDelete}>
  Löschen
</Button>
```

**Varianten:**
- `primary` - Hauptaktionen (blau/schwarz)
- `ghost` - Sekundäre Aktionen (transparent)
- `danger` - Destruktive Aktionen (rot)

---

#### `<Toggle>` - Toggle Switch
Animierter Switch für Boolean-States.

```tsx
<Toggle
  checked={darkMode}
  onChange={setDarkMode}
  label="Dunkler Modus"
  icon={<Moon className="w-4 h-4" />}
/>
```

**Props:**
- `size`: `"sm"` | `"md"` | `"lg"` - Größe des Switches

---

### Feedback

#### `<Alert>` - Benachrichtigung
Alert-Komponente für Messages und Fehler.

```tsx
<Alert variant="success">
  Erfolgreich gespeichert!
</Alert>

<Alert variant="error" title="Fehler">
  Passwort ist zu kurz
</Alert>
```

**Varianten:**
- `info` - Informationen (blau)
- `success` - Erfolg (grün)
- `warning` - Warnung (gelb)
- `error` - Fehler (rot)

---

### Loading States

#### `<Skeleton>` - Loading Placeholder
Animierter Placeholder während Daten laden.

```tsx
<Skeleton className="h-4 w-32" />
<Skeleton className="w-12 h-12 rounded-full" />
```

---

#### `<Spinner>` - Loading Spinner
Rotierendes Icon für aktive Prozesse.

```tsx
<Spinner />
<Spinner size={24} className="text-primary" />

<Button disabled={loading}>
  {loading ? <Spinner size={16} /> : "Speichern"}
</Button>
```

---

## 🎨 Design-System

### Farben

Alle Komponenten nutzen CSS-Variablen aus `globals.css`:

```css
/* Light Mode */
--background: #f8fafc;
--foreground: #0f172a;
--primary: #0f172a;
--accent: #f1f5f9;
--muted-foreground: #64748b;

/* Dark Mode */
--background: #020617;
--foreground: #f8fafc;
--primary: #f8fafc;
```

### Tailwind-Klassen

**Layout:**
- `space-y-{n}` - Vertikaler Abstand
- `gap-{n}` - Grid/Flex Gap
- `p-{n}` / `px-{n}` / `py-{n}` - Padding

**Farben:**
- `bg-primary` / `text-primary` - Hauptfarbe
- `bg-accent` / `text-accent-foreground` - Akzent
- `bg-muted` / `text-muted-foreground` - Abgeschwächt

**Borders:**
- `border` / `border-2` - Border-Width
- `border-border` - Standard-Border-Farbe
- `rounded-xl` / `rounded-2xl` / `rounded-full` - Radius

**States:**
- `hover:` - Hover-State
- `focus:` - Focus-State
- `disabled:` - Disabled-State
- `dark:` - Dark-Mode-Override

---

## 📝 Best Practices

### Komponenten-Nutzung

1. **Immer Komponenten statt rohem HTML verwenden**
   ```tsx
   // ✅ Gut
   <Button variant="primary">Speichern</Button>

   // ❌ Schlecht
   <button className="btn btn-primary">Speichern</button>
   ```

2. **Props für Varianten nutzen**
   ```tsx
   // ✅ Gut
   <Alert variant="error">{error}</Alert>

   // ❌ Schlecht
   <div className="bg-red-50 ...">{error}</div>
   ```

3. **Konsistente Abstände**
   ```tsx
   // ✅ Gut - verwendet space-y
   <div className="space-y-4">
     <Input ... />
     <Input ... />
   </div>

   // ❌ Schlecht - manuelle margins
   <div>
     <Input className="mb-4" ... />
     <Input ... />
   </div>
   ```

### Styling

1. **CSS-Variablen für Farben**
   ```tsx
   // ✅ Gut - nutzt Design-System
   className="bg-primary text-primary-foreground"

   // ❌ Schlecht - hardcoded colors
   className="bg-slate-900 text-white"
   ```

2. **cn() für conditional classes**
   ```tsx
   // ✅ Gut
   className={cn("btn", variant === "danger" && "btn-danger")}

   // ❌ Schlecht
   className={`btn ${variant === "danger" ? "btn-danger" : ""}`}
   ```

3. **Dark Mode mit dark: prefix**
   ```tsx
   // ✅ Gut
   className="bg-white dark:bg-slate-900"

   // ❌ Schlecht - separate dark-mode Komponente
   ```

---

## 🔧 Entwicklung

### Neue Komponente erstellen

1. Erstelle Datei in `/src/components/ui/`
2. Nutze Template mit JSDoc-Kommentaren:

```tsx
/* ============================================================================
   COMPONENT_NAME COMPONENT
   ============================================================================

   Beschreibung...

   Props:
   - prop1: type - Beschreibung

   Verwendung:
   ```tsx
   <ComponentName prop1="value" />
   ```
============================================================================ */

"use client";

import { cn } from "@/lib/utils";

export interface ComponentNameProps {
  /** Prop-Beschreibung */
  prop1: string;
}

export function ComponentName({ prop1 }: ComponentNameProps) {
  return <div>{prop1}</div>;
}
```

3. Exportiere in `/src/components/ui/index.ts` (falls vorhanden)
4. Dokumentiere in dieser README

### Kommentare

- **Header-Kommentar**: Erklärt Zweck und Verwendung
- **Props**: JSDoc für alle Props
- **Inline**: Erklärt komplexe Logik
- **Sections**: Trennt Bereiche mit Kommentaren

---

## 📚 Weitere Ressourcen

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/icons)
- [Framer Motion](https://www.framer.com/motion/)
- [globals.css](../../app/globals.css) - Design-System Variablen
