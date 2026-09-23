# Velocity Design System

## 1. Design Philosophy

Velocity ships **one neutral visual identity**. White carries content and dialogs; a cool gray ground separates the canvas from the slide. Clear typography and consistent controls take priority over decorative warmth. Blue is reserved for the primary action, statistical significance, focus, and a live drop target while dragging. Data series keep their distinct chart palette.

**Core principle:** Components consume **semantic tokens** (`--bg-panel`, `--text-primary`, …) defined in `src/index.css`. Values are static — there is no theme switcher, no runtime theme injection, and no alternate visual directions.

Dark mode is deferred until a pilot asks; when it ships it must be the same identity, not a separate product skin.

---

## 2. Token set (neutral baseline)

Source of truth for values: `src/index.css` for browser CSS and `src/theme/themes.ts` for exporters. The earlier [north-star mock](assets/design-reset-north-star/north_star.html) is historical evidence.

| Token (semantic layer) | Value | Role |
| :--- | :--- | :--- |
| `--bg-app` | `#F6F8FA` | Cool gray ground |
| `--bg-panel` | `#FFFFFF` | Content, slide, dialogs, and palette |
| `--bg-panel-tint` | `#F7F9FB` | Quiet selected and total areas |
| `--bg-rail` | `#EEF2F5` | Hover and active washes |
| `--text-primary` | `#17212B` | Main text |
| `--text-secondary` | `#52606D` | Supporting copy; 6.06:1 on the ground |
| `--text-tertiary` | `#647381` | Small metadata; 4.87:1 on white |
| `--border-color` | `#D9E1E7` | Hairlines |
| `--border-color-muted` | `#E5EBEF` | Row separators |
| `--color-accent` | `#245FA7` | Primary action, significance, focus, live drop target |
| `--viz-fill-primary` | `#6F8177` | Sage — data marks (distributions, charts) |

Focus rings use blue (`--border-color-active` → `--ring` / `#245FA7`).

### Current verification status

The neutral tokens and font change were implemented on September 23, 2026. The token contrast values above pass WCAG AA for normal text. The researcher journey was inspected at 1440×900 and 1280×800; 1024×768 is below the recommended desktop width and shows a notice without covering controls. Other viewport and dense-table cases still need inspection before claiming comprehensive responsive validation.

### Accent budget

Accent appears in four contexts:

1. **Primary action** — Export button on the canvas toolbar and a dialog's final action
2. **Statistical significance** — arrows/letters in crosstab cells and legend
3. **Live drop target** — accent border only while a drag is in progress; neutral dashed otherwise
4. **Keyboard focus** — blue rings communicate the active control

---

## 3. Architecture

### Token layers

1. **Base palette** (`:root` in `src/index.css`) — static neutral values mirrored in `src/theme/themes.ts` for exports
2. **Semantic tokens** — stable API for components (`--bg-panel`, `--text-primary`, `--viz-fill-primary`, …)
3. **Component consumption** — CSS Modules, Tailwind utilities with `var(--token)`, or inline geometry only

There is no `ThemeContext`, no `data-theme` selectors, and no material/blur theme machinery.

### Typography

| Role | Face | Where |
| :--- | :--- | :--- |
| Slide titles | **Plus Jakarta Sans** | Inside the slide artifact |
| Chrome | **Plus Jakarta Sans** | Workspace, toolbars, modals, VM, palette |
| Crosstab values | **Plus Jakarta Sans 600** | Percentages, counts, means, and small numeric annotations; tabular numerals |
| Data identifiers | **JetBrains Mono** | Variable names, codes, and technical labels |

The interface uses one sans-serif family for headings and controls. Long source question labels are displayed as source data; researchers can edit slide titles without changing metadata.

Fonts load via Google Fonts in `index.html` (Plus Jakarta Sans and JetBrains Mono). PowerPoint uses Arial so exported slides render predictably on machines without the app font.

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
--text-tertiary: #647381;
--text-accent: var(--accent);
--text-inverse: var(--primary-foreground);
```

#### Borders
```css
--border-color: var(--border);
--border-color-muted: var(--input);
--border-color-active: var(--ring);   /* visible blue focus */
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

The slide artifact and its statistics line share a maximum reading width of 1120px. Narrower windows use the available width; large virtualized tables scroll inside the artifact. Keep recipe and export controls in the toolbar, close to the result's top edge.

---

## 6. Component patterns

### Borders & radius
```css
--border-width: 1px;
--border-radius-sm: var(--radius);   /* 6px */
```

Hairline discipline: one border weight; row separators use `--border-color-muted`.

### Buttons and controls
Primary actions are filled blue. Secondary actions use a white surface with a hairline border. Tertiary toolbar actions are transparent with a `--bg-rail` hover wash. Use one radius and consistent focus treatment within each control group. Export is the only filled action in the canvas toolbar.

### Shadows
Subtle only: `--shadow-theme: 0 1px 2px 0 rgb(0 0 0 / 0.05)`.

### Motion
Single standard transition: `150ms` ease. Respect `prefers-reduced-motion`. No entrance animations on data; nothing longer than 200ms.

---

## 7. Accessibility

- **Contrast:** WCAG AA (4.5:1 minimum) on panel surfaces
- **Focus:** `outline: 2px solid var(--border-color-active)` (blue ring)
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
<div className="bg-[#FFFFFF] text-[#17212B]">
<div className="rounded-md bg-indigo-600">
```

Do not use CSS fallback hexes such as `var(--bg-panel, #fff)`. Missing tokens are fixed at the semantic layer.

### Tailwind
Approved for layout, spacing, and typography. Color-bearing classes must reference semantic CSS variables.

### CSS Modules
Use for complex states, grids, and selectors that would be unreadable as long utility strings.

### Exports
PPTX/XLSX exporters read theme tokens for branding. Their unbranded fallback uses the same neutral text, blue header, and chart palette. Excel retains numeric weighted totals and displays them to one decimal place.

---

## 9. Data display typography (Analysis Canvas)

Crosstabs and slide chrome use a fixed **case map** (UXP-010–012):

| Surface | Case | Font | Accent |
| :--- | :--- | :--- | :--- |
| Slide title | Title Case | Plus Jakarta Sans inside artifact | Interactive hover only |
| Row/column axis headers | UI caps | Body bold / mono | `text-secondary` |
| Category row labels | As ingested | Body | — |
| Cell values | Numeric formatting | Plus Jakarta Sans 600, tabular, right-aligned | Accent only for significance |

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
