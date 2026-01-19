# Design System: "The Research Desk"

## 1. Design Philosophy

Velocity's interface evokes a **researcher's well-organized desk**: warm lighting, typeset reports, and tools that snap into place with precision. Data is presented as **narrative**, not spreadsheet.

**The Unforgettable Detail:** Tables look like beautifully typeset book pages. Significance markers feel like hand-drawn annotations in terracotta ink.

---

## 2. Typography

### Display Font: Newsreader
*   **Usage:** Page titles, section headers, modal titles.
*   **Weights:** 600 (Semibold) for headers, 400 (Regular) for large body text.
*   **Why:** Editorial confidence. Evokes research journals and reports. Distinctive without being ostentatious.
*   **CDN:** `@import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&display=swap');`

### Body Font: Atkinson Hyperlegible
*   **Usage:** All UI text, table cells, labels, buttons.
*   **Weights:** 400 (Regular), 700 (Bold).
*   **Why:** Designed for accessibility (low-vision users), but refined for everyone. Excellent readability at small sizes (critical for data tables).
*   **CDN:** `@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');`

### Type Scale
```css
--font-display: 'Newsreader', Georgia, serif;
--font-body: 'Atkinson Hyperlegible', -apple-system, sans-serif;

--text-xs: 0.75rem;    /* 12px - Table footnotes */
--text-sm: 0.875rem;   /* 14px - Table cells */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Subheadings */
--text-xl: 1.5rem;     /* 24px - Section headers */
--text-2xl: 2rem;      /* 32px - Page titles */
```

---

## 3. Color System: "Ink & Paper"

### Primary Palette
```css
--color-ink: #1C1C1C;           /* Rich black - Primary text */
--color-paper: #F5F3EF;         /* Warm off-white - Background */
--color-terracotta: #E07A5F;    /* Accent - Sig markers, CTAs */
--color-charcoal: #3D3835;      /* Dark gray - Secondary text */
--color-parchment: #FDFCFA;     /* Lighter warm white - Cards */
```

### Functional Colors
```css
--color-success: #52796F;       /* Muted teal */
--color-warning: #F4A261;       /* Warm amber */
--color-error: #C1666B;         /* Muted red */
--color-info: #84A59D;          /* Sage green */
```

### Neutrals (Warm Grays)
```css
--gray-50: #FAFAF9;
--gray-100: #F5F3EF;
--gray-200: #E8E5E0;
--gray-300: #D4CFC7;
--gray-400: #A8A29E;
--gray-500: #78716C;
--gray-600: #57534E;
--gray-700: #3D3835;
--gray-800: #292524;
--gray-900: #1C1C1C;
```

---

## 4. Spacing & Layout

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
*   **Sidebar (Pantry):** Fixed `280px` width.
*   **Canvas:** Fluid, max-width `1400px`, centered.
*   **Gutter:** `--space-8` (32px) between major sections.

---

## 5. Component Styles

### Borders & Corners
```css
--border-width: 1px;
--border-color: var(--gray-200);
--border-radius-sm: 4px;   /* Buttons, inputs */
--border-radius-md: 8px;   /* Cards, modals */
--border-radius-lg: 12px;  /* Large panels */
```

### Shadows
```css
/* Inset panels (sidebars, modals) */
--shadow-inset: inset 0 1px 2px rgba(28, 28, 28, 0.05);

/* Floating elements (tooltips, dropdowns) */
--shadow-float: 0 4px 12px rgba(28, 28, 28, 0.08);

/* Dragging state */
--shadow-drag: 0 8px 24px rgba(28, 28, 28, 0.15);
```

### Tables (Editorial Style)
*   **No outer borders.** Only `border-bottom` on rows.
*   **Header:** Bold Atkinson, `--color-charcoal`, `border-bottom: 2px solid var(--gray-300)`.
*   **Cells:** `--text-sm`, `padding: var(--space-3) var(--space-4)`.
*   **Hover:** Subtle background `var(--gray-50)`.
*   **Significance Markers:** Superscript letters in `--color-terracotta`, bold.

---

## 6. Motion & Interaction

### Timing Functions
```css
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1);  /* Material standard */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Elastic snap */
```

### Transitions
```css
--transition-fast: 150ms var(--ease-standard);
--transition-base: 250ms var(--ease-standard);
--transition-slow: 400ms var(--ease-standard);
```

### Animations
*   **Table Row Reveal:** Staggered fade-in on load.
    ```css
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    /* Apply with animation-delay: calc(var(--index) * 30ms); */
    ```
*   **Drag Ghost:** Scale up slightly (`transform: scale(1.02)`), apply `--shadow-drag`.
*   **Button Hover:** Subtle lift (`transform: translateY(-1px)`), transition `150ms`.

---

## 7. Accessibility

*   **Contrast Ratios:** All text meets WCAG AA (4.5:1 minimum).
*   **Focus States:** `outline: 2px solid var(--color-terracotta)`, `outline-offset: 2px`.
*   **Keyboard Navigation:** All interactive elements must be reachable via Tab.
*   **Screen Readers:** Use semantic HTML (`<table>`, `<button>`, ARIA labels where needed).

---

## 8. Implementation Notes

### CSS Architecture
*   Use **CSS Custom Properties** for all tokens.
*   Organize styles by component in `/src/styles/components/`.
*   Global tokens in `/src/styles/tokens.css`.

### Dark Mode (Future)
*   Invert palette: `--color-paper` becomes `#1C1C1C`, `--color-ink` becomes `#F5F3EF`.
*   Reduce shadow opacity by 50%.
