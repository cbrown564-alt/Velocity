# Velocity Design System

## 1. Design Philosophy

Velocity's interface is built on a **dynamic theme system** that allows users to choose the aesthetic that best suits their workflow and preferences. Rather than a single fixed design language, Velocity offers three distinct visual directions—each optimized for different use cases while maintaining consistency through a shared semantic token architecture.

**Core Principle:** Design tokens are injected dynamically at runtime, allowing themes to define not just colors, but complete visual materials including translucency, blur effects, and typography systems.

---

## 2. Architecture Overview

### Theme System Structure

Velocity uses a **token-based architecture** with three layers:

1. **Theme Definitions** (`src/theme/themes.ts`)
   - Each theme defines colors, typography, materials, radius, and shadows
   - Themes can optionally define "materials" for advanced visual effects (blur, translucency)

2. **Theme Context** (`src/context/ThemeContext.tsx`)
   - Dynamically injects CSS custom properties at runtime
   - Manages theme switching and persistence
   - Converts theme objects into CSS variables

3. **Semantic Token Layer** (`src/index.css`)
   - Maps theme-agnostic semantic tokens to theme-specific values
   - Provides stable API for components (e.g., `--bg-panel`, `--text-primary`)
   - Ensures components work across all themes without modification

### Material-Based Tokens

For advanced themes (like Liquid Glass), Velocity supports **composite material tokens** that go beyond simple colors:

```typescript
interface ThemeMaterial {
  background: string;       // Color + Opacity
  backdropFilter?: string;  // Blur + Saturation
  border?: string;          // Border color/style
  noiseOpacity?: number;    // Optional texture
}
```

These are injected as `--mat-{surface}-{property}` variables and consumed by utility classes.

---

## 3. Available Themes

### Soft Machine (Default)
**Philosophy:** Warm, organic, human-centric interface inspired by Dieter Rams and 1970s computing.

**Visual Language:**
- **Background:** Warm light gray (#F0EDE8) with cream panels (#FAF8F5)
- **Typography:** 
  - Display: Fraunces (variable optical sizing, soft serifs)
  - UI/Data: Plus Jakarta Sans (friendly geometric)
  - Mono: JetBrains Mono
- **Color System:**
  - Primary: Deep forest green (#2D4A3E)
  - Accent: Coral (#E07860)
  - Muted earth tones and warm sand spectrum
- **Radius:** Large (lg) - 8-12px rounded corners
- **Interaction:** Left accent bar on hover (coral vertical stripe)

**Best For:** Extended analysis sessions, reduced eye strain, approachable aesthetic

---

### Mission Control
**Philosophy:** High-contrast dark interface inspired by NASA mission control, Bloomberg terminals, and flight decks.

**Visual Language:**
- **Background:** Deep charcoal (#141414) with subtle blue undertones
- **Typography:**
  - Display/UI: DM Sans (geometric sans)
  - Mono: JetBrains Mono (for data)
- **Color System:**
  - Primary: Electric cyan (#00D4FF) for active states and significance
  - Warning: Amber (#FFB800)
  - Success: Mint (#00E5A0)
  - Muted blue-gray borders (#2A2D35)
- **Radius:** Small (sm) - tight 4px corners
- **Interaction:** Radar sweep scanline on hover (cyan line animates across row)

**Best For:** Data-intensive work, power users, extended dark mode sessions

**Signature Detail:** When hovering over data rows, a thin cyan scan-line animates across—like a radar sweep confirming selection.

---

### Liquid Glass
**Philosophy:** Translucent, biomorphic interface inspired by Apple's visionOS and spatial computing.

**Visual Language:**
- **Background:** Soft gradient mesh with radial gradients in pastel hues
- **Typography:**
  - System fonts: -apple-system, SF Pro Display/Text
  - Mono: SF Mono, Menlo
- **Color System:**
  - Primary: System Blue (#007AFF)
  - Apple's standard palette (greens, oranges, pinks, purples)
  - Semi-transparent surfaces with backdrop blur
- **Materials:**
  - Panel: `rgba(255, 255, 255, 0.3)` with `blur(25px) saturate(180%)`
  - Overlay: `rgba(255, 255, 255, 0.4)` with `blur(40px) saturate(200%)`
  - Specular borders: `rgba(255, 255, 255, 0.3)`
- **Radius:** Extra large (2xl) - 16px rounded corners
- **Shadow:** Deep, soft shadows with color

**Best For:** Presentation mode, client-facing work, visual appeal

**Signature Detail:** Frosted glass panels with live background blur and subtle gradient mesh background.

---

## 4. Typography System

### Font Loading
All theme fonts are loaded via Google Fonts CDN in `index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
```

### Type Scale (Theme-Agnostic)
```css
--text-xxs: 0.625rem;  /* 10px */
--text-xs: 0.75rem;    /* 12px - Table footnotes */
--text-sm: 0.875rem;   /* 14px - Table cells */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Subheadings */
--text-xl: 1.5rem;     /* 24px - Section headers */
--text-2xl: 2rem;      /* 32px - Page titles */
```

### Font Variables (Theme-Specific)
Each theme defines:
- `--font-body`: UI text, table cells, labels, buttons
- `--font-display`: Page titles, section headers, modal titles
- `--font-mono`: Data cells, code, statistics (tabular figures)

---

## 5. Color System

### Semantic Token Architecture

Rather than using theme colors directly, components consume **semantic tokens** that map to theme-specific values:

#### Surface & Backgrounds
```css
--bg-app: var(--background);        /* Main application background */
--bg-panel: var(--card);            /* Cards, modals, panels */
--bg-surface: var(--popover);       /* Popovers, dropdowns */
--bg-active: var(--secondary);      /* Active/selected states */
```

#### Typography
```css
--text-primary: var(--foreground);          /* Primary text */
--text-secondary: var(--muted-foreground);  /* Secondary text */
--text-tertiary: var(--muted-foreground);   /* Low-emphasis helper text */
--text-accent: var(--accent);               /* Accent text */
--text-inverse: var(--primary-foreground);  /* Text on colored backgrounds */
```

#### Borders & Dividers
```css
--border-color: var(--border);              /* Standard borders */
--border-color-muted: var(--input);         /* Subtle borders */
--border-color-active: var(--ring);         /* Focus/active borders */
--border-grid: var(--viz-grid);             /* Data grid lines */
```

#### Interaction & Status
```css
--bg-hover: var(--secondary);               /* Hover states */
--status-success-text / --status-success-bg /* Success states */
--status-warning-text / --status-warning-bg /* Warning states */
--status-error-text / --status-error-bg     /* Error states */
```

#### Data Visualization
```css
--viz-fill-primary: var(--viz-primary);     /* Main bars/marks */
--viz-fill-secondary: var(--viz-secondary); /* Comparison/highlight */
--viz-stroke-main: var(--viz-stroke);       /* Axis lines */
--viz-grid-line: var(--viz-grid);           /* Chart grid */
--viz-text-value: var(--viz-text-value);    /* Text on bars */
--viz-text-axis: var(--viz-text-axis);      /* Axis labels */
```

#### Categorical Palettes
Each theme defines 6 categorical colors (`--viz-palette-1` through `--viz-palette-6`) and a 10-point diverging scale (`--viz-scale-1` through `--viz-scale-10`).

#### Variable Type Tags
```css
--tag-nominal-bg/text   /* Nominal variables */
--tag-ordinal-bg/text   /* Ordinal variables */
--tag-scale-bg/text     /* Scale/numeric variables */
--tag-text-bg/text      /* Text variables */
--tag-date-bg/text      /* Date/time variables */
```

---

## 6. Spacing & Layout

### Spacing Scale (8px base)
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

### Layout Grid
- **Sidebar (Variable Manager):** Fixed width, scrollable
- **Canvas (Dashboard):** Fluid, responsive
- **Gutter:** `--space-8` (32px) between major sections

---

## 7. Component Styles

### Borders & Corners
```css
--border-width: 1px;
--border-radius-sm: var(--radius);              /* Theme-defined */
--border-radius-md: calc(var(--radius) + 2px);
--border-radius-lg: calc(var(--radius) + 4px);
```

Each theme defines its own `radius` preference:
- Soft Machine: `lg` (8px)
- Mission Control: `sm` (2px)
- Liquid Glass: `2xl` (16px)

### Shadows
Themes define a `shadow` level (none, sm, md, lg, xl, 2xl, glow) which is mapped to CSS box-shadow values. Mission Control uses deeper shadows; Soft Machine uses subtle shadows.

### Material Surfaces (Liquid Glass)
For themes with `materials` defined, special utility classes consume material tokens:

```css
.surface-panel {
  background: var(--mat-panel-bg, var(--bg-panel));
  backdrop-filter: var(--mat-panel-filter, none);
  border: 1px solid var(--mat-panel-border, transparent);
}
```

This allows Liquid Glass to apply blur and translucency while other themes fall back to solid colors.

---

## 8. Motion & Interaction

### Timing Functions
```css
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1);  /* Material standard */
```

### Transitions
```css
--transition-fast: 150ms var(--ease-standard);
--transition-base: 250ms var(--ease-standard);
--transition-slow: 400ms var(--ease-standard);
```

### Theme-Specific Interactions

#### Mission Control: Radar Sweep
Data rows have a cyan scanline that sweeps across on hover:
```css
[data-theme="mission-control"] .data-row-interactive::after {
  /* Animated cyan line */
  width: 0%;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
[data-theme="mission-control"] .data-row-interactive:hover::after {
  width: 100%;
}
```

#### Soft Machine: Left Accent Bar
Data rows show a coral vertical bar on the left edge on hover:
```css
[data-theme="soft-machine"] .data-row-interactive td:first-child::before {
  /* 3px coral bar */
  transform: scaleY(0);
  transition: transform 0.2s;
}
[data-theme="soft-machine"] .data-row-interactive:hover td:first-child::before {
  transform: scaleY(1);
}
```

---

## 9. Accessibility

- **Contrast Ratios:** All text meets WCAG AA (4.5:1 minimum)
- **Focus States:** `outline: 2px solid var(--color-accent)`, `outline-offset: 2px`
- **Keyboard Navigation:** All interactive elements reachable via Tab
- **Screen Readers:** Semantic HTML (`<table>`, `<button>`, ARIA labels)
- **Font Choice:** Atkinson Hyperlegible (used in Soft Machine) designed for low-vision users

---

## 10. Implementation Guide

### Adding a New Theme

1. **Define the theme** in `src/theme/themes.ts`:
   ```typescript
   export const myTheme: Theme = {
     id: 'my-theme',
     name: 'My Theme',
     description: 'Description here',
     mode: 'light', // or 'dark'
     colors: { /* ... */ },
     radius: 'md',
     shadow: 'md',
     typography: { /* ... */ },
     materials: { /* optional */ }
   };
   ```

2. **Add to themes array**:
   ```typescript
   export const themes = [softMachine, missionControl, liquidGlass, myTheme];
   ```

3. **Add theme-specific overrides** in `index.css` (if needed):
   ```css
   [data-theme="my-theme"] {
     /* Custom shadows, animations, etc. */
   }
   ```

### Using Semantic Tokens in Components

**Always use semantic tokens, never theme colors directly:**

✅ Good:
```tsx
<div className="bg-[var(--bg-panel)] text-[var(--text-primary)]">
```

❌ Bad:
```tsx
<div className="bg-[#FAF8F5] text-[#2D4A3E]">
```

### Tailwind Usage

Tailwind CSS is approved for layout, spacing, typography utilities, and rapid composition. Color-bearing Tailwind classes must reference semantic CSS variables so components remain theme-neutral.

✅ Good:
```tsx
<button className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-[var(--text-inverse)]">
```

❌ Bad:
```tsx
<button className="rounded-md bg-indigo-600 px-3 py-2 text-white">
```

Use CSS Modules for complex component states, animation, grid layouts, and selectors that would become unreadable as long utility strings. Inline styles are acceptable for dynamic chart, D3, virtualization, or geometry values.

Do not use CSS fallback hexes such as `var(--bg-panel, #fff)`. Missing tokens should be fixed at the semantic-token layer instead of hidden by theme-specific fallback values.

### Material Surfaces

For panels that should support Liquid Glass blur effects:

```tsx
<div className="surface-panel">
  {/* Content */}
</div>
```

Or use the Tailwind escape hatch with fallback:
```tsx
<div className="bg-[var(--bg-panel)]">
  {/* Liquid Glass theme will automatically apply materials */}
</div>
```

### Theme Context Usage

```typescript
import { useTheme } from '@/context/ThemeContext';

function ThemeSwitcher() {
  const { theme, setTheme, availableThemes } = useTheme();
  
  return (
    <select value={theme.id} onChange={(e) => setTheme(e.target.value)}>
      {availableThemes.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
```

---

## 11. Design Rationale

### Why Multiple Themes?

Different users have different needs:

- **Researchers doing long analysis sessions** benefit from Soft Machine's warm, low-strain aesthetic
- **Power users working with dense data** prefer Mission Control's high-contrast, information-dense approach
- **Consultants presenting to clients** want Liquid Glass's polished, modern appearance

### Why Token-Based Architecture?

1. **Consistency:** Components automatically adapt to theme changes
2. **Maintainability:** Change a theme's color once, update everywhere
3. **Extensibility:** New themes can be added without touching component code
4. **Advanced Effects:** Material tokens enable blur, translucency, and other CSS effects

### Why Semantic Tokens?

Direct theme tokens (like `--viz-palette-1`) are too specific. Semantic tokens (like `--viz-fill-primary`) describe *purpose*, allowing themes to map different colors to the same purpose.

---

## 12. Future Considerations

### Dark Mode Variants
Currently Mission Control is the only dark theme. Future work could include:
- Dark variants of Soft Machine and Liquid Glass
- Automatic dark mode switching based on system preferences

### User-Defined Themes
The architecture supports user-created themes. Future UI could allow:
- Custom color picker for all tokens
- Import/export theme JSON
- Theme marketplace/sharing

### Accessibility Themes
Potential high-contrast themes optimized for:
- Low vision users
- Color blindness (deuteranopia, protanopia, tritanopia)
- Reduced motion preferences

---

## 13. Cleanup Notes

Legacy Research Desk tokens and raw Tailwind palette colors are deprecated. Components should use semantic tokens from this document, Tailwind utilities with CSS-variable color values, or CSS Modules backed by the same tokens.
