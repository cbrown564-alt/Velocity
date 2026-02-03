# Styling Fragmentation Audit & Remediation Plan

**Date**: 2026-01-26
**Scope**: Styling consistency, Variable Manager, Shared Components

## Executive Summary

A deep dive into the `src/features/variableManager` and `src/components` directories confirms significant styling fragmentation. The application suffers from a "split brain" styling architecture:

1.  **CSS Modules vs. Tailwind**: Components arbitrarily mix Semantic CSS Modules with Ad-hoc Tailwind utilities.
2.  **Hardcoded Values**: Hex codes and RGBA values are scattered across CSS, TSX, and Logic, bypassing the design tokens.
3.  **Inline Overrides**: EXTENSIVE use of `style={{ ... }}` for layout and theming, ignoring both Tailwind and CSS Modules.

This fragmentation makes global theming (e.g., "Mission Control" vs "Research Desk") brittle and maintenance difficult.

---

## 1. Fragmentation Inventory

### A. CSS Modules with Hardcoded Values (Bypassing Tokens)
These files use CSS Modules but define colors explicitly instead of using `var(--token)`.

*   **`src/features/variableManager/VariableInspector.module.css`**
    *   Hardcoded Hex: `#673ab7`, `#2196f3` (in `.typeBadgeText`, `.typeBadgeDate`)
    *   Hardcoded RGBA: `rgba(103, 58, 183, 0.15)`, `rgba(245, 166, 35, 0.1)` (Warning Banner)
    *   Missing Semantic Tokens: Uses `var(--gray-400)` instead of `var(--text-secondary)` in some places.

*   **`src/features/variableManager/MillerColumns.module.css`**
    *   Hardcoded Transparency: `rgba(224, 122, 95, 0.05)` (Accent color with alpha).
    *   Design Smell: Explicit pixel widths for columns defined in `:root` inside this module, largely disconnected from global layout constants.

*   **`src/features/variableManager/components/FacetedSearchBar.module.css`**
    *   Hardcoded RGBA: `rgba(255, 255, 255, 0.2)` (Facet count background), `rgba(0, 0, 0, 0.1)` (Chip remove hover).

### B. Tailwind Arbitrary Values (The "Magic Number" Anti-Pattern)
These components use Tailwind's arbitrary value syntax `[]` which hardcodes styling into the markup.

*   **`src/features/dashboard/components/DataTable.tsx`**
    *   `bg-[#1A1F24]/80`: Hardcoded dark mode background color.
    *   `bg-indigo-500`, `bg-emerald-500`: Hardcoded palette in `CHART_COLORS` constant (bypassing `--viz-palette-*` tokens).

### C. Inline Style Logic (The "JS-in-CSS" Leak)
Logic that calculates styles in TypeScript and injects them via `style={...}`.

*   **`src/features/variableManager/VariableInspector.tsx`**
    *   **Font Injection**: `style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)'... }}` (Lines 403+).
    *   **Color Logic**: `style={{ backgroundColor: 'var(--status-warning-text)', color: 'var(--bg-app)' }}`.
    *   **Conditionals**: Completeness bar color logic is inside the render function, not in CSS classes.

*   **`src/features/variableManager/VariableColumn.tsx`**
    *   **Opacity Logic**: `color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--gray-400)'`.

*   **`src/features/variableManager/Sparkline.tsx`**
    *   **Pure SVG Styling**: While SVGs often need attributes, the *container* styles and opacity logic are hardcoded `style={{...}}` blocks rather than classes.
    *   **Hardcoded Fallback**: `isModerate ? '#ea580c' ...`.

---

## 2. The Remediation Strategy

To achieve the "Mission Control" aesthetic and robustness:

### Step 1: Consolidate to Semantic Tokens (`src/index.css`)
We need to ensure every hardcoded value has a corresponding semantic token.

*   **Action**: Create Alpha-variant tokens for accents.
    *   Instead of `rgba(224, 122, 95, 0.05)`, define `--color-accent-subtle: var(--theme-color-accent-subtle)`.
*   **Action**: Move specific palette colors (Indigo, Emerald) to `viz-palette` tokens if they aren't already mapped.

### Step 2: Purge Inline Styles
Move `style={{...}}` blocks into CSS Modules or Tailwind classes.

*   **Target**: `VariableInspector.tsx` lines 403-408 -> `.variableIdTag` in CSS Module.
*   **Target**: `VariableColumn.tsx` opacity logic -> Use CSS opacity or `text-opacity-70` class.

### Step 3: Remove Arbitrary Tailwind
Replace `[#hex]` with semantic classes.

*   `bg-[#1A1F24]/80` -> `bg-[var(--bg-surface-2)]` or similar token.

### Step 4: Standardize on ONE Layout System
The app currently mixes Flexbox in CSS Modules (Miller Columns) with Flexbox in Tailwind (DataTable).

*   **Recommendation**:
    *   **Page Layout / Containers**: Styles matching file structure (CSS Modules) are safer for complex layouts like Miller Columns.
    *   **Leaf Nodes / Typography**: Tailwind utility classes (using Semantic Tokens) are faster and more consistent.
    *   **CRITICAL**: IF using Tailwind, use `text-[var(--text-primary)]`, NEVER `text-gray-900`.

---

## 3. Action Item Checklist

- [x] **Refafctor `VariableInspector.tsx`**: Extract all inline styles to `VariableInspector.module.css`.
- [x] **Refactor `VariableInspector.module.css`**: Replace all hex codes/rgba with `var(--)` tokens.
- [x] **Refactor `Sparkline.tsx`**: Move color logic to CSS variables (e.g. `data-variant="critical"` css rules).
- [x] **Refactor `DataTable.tsx`**: Replace `bg-[#...]` with defined theme token.
