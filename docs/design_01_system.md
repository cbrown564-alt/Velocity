# Velocity Design System

## 1. Design Philosophy

Velocity ships **one visual identity** — evolved Soft Machine. The interface recedes into a warm ground; the slide card is the artifact; chrome stays quiet. Accent color appears only on the primary action, statistical significance, and a live drop target while dragging.

**Core principle:** Components consume **semantic tokens** (`--bg-panel`, `--text-primary`, …) defined in `src/index.css`. Values are static — there is no theme switcher, no runtime theme injection, and no alternate visual directions.

Dark mode is deferred until a pilot asks; when it ships it must be the same identity, not a separate product skin.

---

## 2. Token set (evolved Soft Machine)

Source of truth for values: [`docs/assets/design-reset-north-star/north_star.html`](assets/design-reset-north-star/north_star.html). Production faces replace the mock's system stand-ins.

| Token (semantic layer) | Value | Role |
| :--- | :--- | :--- |
| `--bg-app` | `#F1EFEA` | Ground — everything non-artifact recedes into this |
| `--bg-panel` | `#FDFCFA` | The slide card (and true overlays: palette, modals, inspector chips) |
| `--bg-panel-tint` | `#F7F5F0` | Total-column tint, selected-row tint |
| `--bg-rail` | `#ECE9E3` | Hover/active washes on ground surfaces |
| `--text-primary` | `#24302A` | Green-ink |
| `--text-secondary` | `#67736C` | Passes 4.5:1 on panel |
| `--text-tertiary` | `#9AA39C` | Metadata, disabled |
| `--border-color` | `#E3DFD7` | Hairlines |
| `--border-color-muted` | `#ECE8E1` | Row separators |
| `--color-accent` | `#B54E33` | Sienna — primary action + significance + live drop target **only** |
| `--viz-fill-primary` | `#6F8177` | Sage — data marks (distributions, charts) |

Focus rings use ink (`--border-color-active` → `--ring` / `#24302A`), not accent.

### Accent budget

Accent appears in exactly three contexts:

1. **Primary action** — Export button on the canvas toolbar
2. **Statistical significance** — arrows/letters in crosstab cells and legend
3. **Live drop target** — accent border only while a drag is in progress; neutral dashed otherwise

Screens with no export or significance show zero accent-colored chrome.

---

## 3. Architecture

### Token layers

1. **Base palette** (`:root` in `src/index.css`) — static evolved Soft Machine values
2. **Semantic tokens** — stable API for components (`--bg-panel`, `--text-primary`, `--viz-fill-primary`, …)
3. **Component consumption** — CSS Modules, Tailwind utilities with `var(--token)`, or inline geometry only

There is no `ThemeContext`, no `data-theme` selectors, and no material/blur theme machinery.

### Typography

| Role | Face | Where |
| :--- | :--- | :--- |
| Slide titles | **Fraunces** | Inside the slide artifact only |
| Chrome | **Plus Jakarta Sans** | Workspace, toolbars, modals, VM, palette |
| Data | **JetBrains Mono** | Cells, variable names, tabular figures |

The serif **never** appears on chrome.

Fonts load via Google Fonts in `index.css` (Fraunces, Plus Jakarta Sans, JetBrains Mono only).

### Type scale

```css
--text-xxs: 0.625rem;  /* 10px */
--text-xs: 0.6875rem;  /* 11px — caps labels */
--text-sm: 0.8125rem;  /* 13px — UI base */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;
--text-xl: 1.5rem;
--text-2xl: 2rem;
```

UI chrome uses 13px base; caps labels at 11px with letter-spacing; all numeric columns use `tabular-nums`.

---

## 4. Color system (semantic tokens)

Components consume semantic tokens, not raw hex:

#### Surfaces
```css
--bg-app: var(--background);
--bg-panel: var(--card);
--bg-panel-tint: var(--muted);
--bg-rail: var(--secondary);
--bg-surface: var(--popover);
--bg-hover: var(--secondary);
```

#### Typography
```css
--text-primary: var(--foreground);
--text-secondary: var(--muted-foreground);
--text-tertiary: #9aa39c;
--text-accent: var(--accent);
--text-inverse: var(--primary-foreground);
```

#### Borders
```css
--border-color: var(--border);
--border-color-muted: var(--input);
--border-color-active: var(--ring);   /* ink focus, not accent */
--border-grid: var(--viz-grid);
```

#### Data visualization
```css
--viz-fill-primary: var(--viz-primary);
--viz-fill-secondary: var(--viz-secondary);
--viz-stroke-main: var(--viz-stroke);
--viz-grid-line: var(--viz-grid);
```

Categorical palettes (`--viz-palette-1` … `--viz-palette-6`) and diverging scales remain for multi-series charts. Variable type glyphs are **monochrome** (ink on hairline-bordered box) — no per-type color tags.

---

## 5. Spacing & layout

8px base scale:

```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
```

Layout regions: story rail (deck outline), canvas (slide artifact), collapsible recipe inspector, summoned insert palette, two-pane Variable Manager overlay.

---

## 6. Component patterns

### Borders & radius
```css
--border-width: 1px;
--border-radius-sm: var(--radius);   /* 6px */
```

Hairline discipline: one border weight; row separators use `--border-color-muted`.

### Ghost buttons (toolbar)
Transparent default, `--bg-rail` hover, no borders. Export is the only filled accent control on the canvas screen.

### Shadows
Subtle only: `--shadow-theme: 0 1px 2px 0 rgb(0 0 0 / 0.05)`.

### Motion
Single standard transition: `150ms` ease. Respect `prefers-reduced-motion`. No entrance animations on data; nothing longer than 200ms.

---

## 7. Accessibility

- **Contrast:** WCAG AA (4.5:1 minimum) on panel surfaces
- **Focus:** `outline: 2px solid var(--border-color-active)` (ink ring)
- **Keyboard:** All interactive elements reachable; `?` overlay is the reference surface
- **Screen readers:** Semantic HTML and ARIA on tables, buttons, and modals

High-contrast and colorblind significance themes (UXF-016) remain frozen until a pilot requests them.

---

## 8. Implementation guide

### Using tokens in components

✅ Good:
```tsx
<div className="bg-[var(--bg-panel)] text-[var(--text-primary)]">
```

❌ Bad:
```tsx
<div className="bg-[#FDFCFA] text-[#24302A]">
<div className="rounded-md bg-indigo-600">
```

Do not use CSS fallback hexes such as `var(--bg-panel, #fff)`. Missing tokens are fixed at the semantic layer.

### Tailwind
Approved for layout, spacing, and typography. Color-bearing classes must reference semantic CSS variables.

### CSS Modules
Use for complex states, grids, and selectors that would be unreadable as long utility strings.

### Exports
PPTX/XLSX exporters read theme tokens for branding. They use the same single token set as the canvas.

---

## 9. Data display typography (Analysis Canvas)

Crosstabs and slide chrome use a fixed **case map** (UXP-010–012):

| Surface | Case | Font | Accent |
| :--- | :--- | :--- | :--- |
| Slide title | Title Case | Fraunces inside artifact | Interactive hover only |
| Row/column axis headers | UI caps | Body bold / mono | `text-secondary` |
| Category row labels | As ingested | Body | — |
| Cell values | Numeric formatting | Mono, tabular, right-aligned | Accent only for significance |

**Column alignment (Strategy A):** Axis headers left; numeric block right-aligned on a shared edge.

Implementation: `src/core/text/displayCase.ts`; `resolveSlideTitle`; `DataTable`; `CrosstabCell`.

**Layout rule (UXP-020):** Never use `opacity-0` on in-flow content affecting column width. Hover chrome must be `position: absolute`.

**Statistics visibility (UXP-040 / UXF-005):** Cell n and Bases toggles live in the recipe inspector (deck-clean defaults off). The filtered N in the slide subtitle is unaffected (UXR-010). Exports mirror canvas defaults.

**Content-aware slide height (UXF-004):** Slide card shrink-wraps table content; caps at canvas height with internal scroll. Statistics status renders as a muted margin note **outside** the card — never in PPTX.

---

## 10. Evidence & references

- North-star mock: [`docs/assets/design-reset-north-star/`](assets/design-reset-north-star/)
- Post-reset screenshot pack: [`docs/assets/design-reset-evidence/`](assets/design-reset-evidence/)
- Implementation plan: [`docs/plan_05_design_reset_implementation.md`](plan_05_design_reset_implementation.md)
- UX modes (rail / palette / inspector): [`docs/design_02_ux_modes.md`](design_02_ux_modes.md)
