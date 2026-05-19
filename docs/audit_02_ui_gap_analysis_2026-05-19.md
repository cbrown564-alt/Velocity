# Velocity UI Gap Analysis: From Good to Great

**Date:** May 19, 2026  
**Context:** Post-stabilization sprint (`STAB-*` complete). Phase 4 follow-through active.  
**Scope:** Full UI/UX surface — Workspace, Analysis Canvas, Variable Manager, Harmonization, Modals, and Theme System.  
**Goal:** Identify the major opportunities to elevate Velocity from "looks and feels good" to "looks and feels great."

---

## 1. Executive Summary

Velocity's UI is **architecturally sound** — the three-mode model (Workspace → Canvas → Manager) is coherent, the design token system is well-structured, and the component library covers the major surfaces. The stabilization sprint fixed token discipline, export quality, and design-system CI. But there is a meaningful gap between "functionally complete" and "delightfully crafted."

**The core insight:** Velocity has the bones of a premium tool but lacks the **polish, coherence, and intentional micro-experience design** that separates good B2B software from great software. The gaps are not in missing features — they are in how the existing features *feel* to use.

**Top 5 opportunities (ranked by impact × feasibility):**

1. **Motion System Overhaul** — Unify animation language, add `prefers-reduced-motion`, and introduce purposeful data transitions
2. **Onboarding & Empty-State Narrative** — First-run experience, contextual guidance, and zero-data states that teach rather than block
3. **Data-Density Refinement** — Information hierarchy, whitespace discipline, and scanability improvements across Canvas and Manager
4. **Theme System Completion** — Dark variants for all themes, Liquid Glass maturity, and accessibility themes
5. **Micro-Interaction & Feedback Layer** — Progress indicators, hover states, and action confirmation that build user confidence

---

## 2. Current State: What's Working Well

Before identifying gaps, acknowledge the solid foundation:

| Area | Assessment | Evidence |
|------|-----------|----------|
| **Theme Architecture** | Excellent. Three distinct themes with semantic tokens, runtime injection, material support. | `src/theme/themes.ts`, `src/context/ThemeContext.tsx` |
| **Component Coverage** | Strong. All major surfaces have dedicated components with DnD, virtualization, modals. | `App.tsx`, `DashboardShell.tsx`, `WorkspaceView.tsx`, `VariableManager.tsx` |
| **Animation Infrastructure** | Good. Framer Motion is used pervasively for enter/exit, layout, and micro-interactions. | ~20 files use `motion.div`, `AnimatePresence` |
| **Token Discipline** | Good. CI enforces no raw Tailwind palette; `color-mix()` is used extensively. | `scripts/check-design-tokens.mjs` (empty allowlist) |
| **Chart Tokenization** | Excellent. All chart colors use CSS variables; no hardcoded hex in renderers. | `AnalysisChart.tsx`, renderer files |
| **Keyboard Shortcuts** | Good. D, N, ←/→, Delete, ⌘A, Esc all wired. | `AppShell.tsx`, `TimelineDock.tsx` |
| **Mode Architecture** | Strong. Hub-and-spoke model with soft-modal overlay pattern is correct. | `design_02_ux_modes.md`, `AppShell.tsx` |

---

## 3. Gap Analysis

### 3.1 Motion & Animation: Functional but Not Cohesive

**Current State:** Framer Motion is used widely but inconsistently. Easings, durations, and patterns vary across files. Some animations feel arbitrary rather than purposeful.

**Specific Gaps:**

| Gap | Example | Severity |
|-----|---------|----------|
| **No `prefers-reduced-motion` support** | Entire codebase ignores accessibility setting | **High** |
| **Inconsistent transition values** | Some use `0.15s ease`, others `var(--transition-fast)`, others `0.2s easeOut` | Medium |
| **Over-broad transition properties** | `transition: all 0.15s ease` causes unintended animations | Medium |
| **Missing data-transition patterns** | Crosstab cells appear instantly; no "count-up" or stagger for row insertion | Medium |
| **Modal exit animations broken** | Some modals snap away without exit animation | Low |
| **No page transition** | Workspace → Dashboard is an instant cut | Low |

**What Great Looks Like:**
- **Linear** uses a unified motion language: every element enters with the same easing curve (`cubic-bezier(0.25, 0.1, 0.25, 1)`), exits with a faster reverse, and layout shifts use `layout` props
- **Notion** animates list items with staggered fade-slide, making the interface feel alive
- **Raycast** uses spring physics for all interactions, giving a tactile quality

**Creative Solutions:**
1. **Unified Motion DSL** — Create a `motion.ts` utility that exports preset variants (`fadeIn`, `slideUp`, `scaleIn`, `staggerChildren`) with consistent timing. All components consume these presets.
2. **Data Choreography** — When a crosstab updates, new rows stagger in (50ms delay each), counts animate from 0 to value (300ms), and significance markers pulse once. This makes statistical computation *feel* computational.
3. **Reduced Motion Audit** — Wrap all `motion.div` calls in a `AccessibleMotion` component that respects `prefers-reduced-motion` by falling back to instant transitions or opacity-only fades.
4. **Workspace → Dashboard Transition** — A shared-element transition: the dataset card scales up and morphs into the slide canvas, with the sidebar variables sliding in from the left.

---

### 3.2 Onboarding & Empty States: The Silent Killer

**Current State:** Empty states are basic. The workspace has a reasonable empty state with motion, but the Canvas has minimal guidance for first-time users. There is no progressive disclosure — every feature is visible immediately.

**Specific Gaps:**

| Gap | Example | Severity |
|-----|---------|----------|
| **No first-run guided tour** | New users see the full Canvas with no indication of what to do first | **High** |
| **Empty canvas is just blank** | No drop-zone callouts, no "Drag a variable here" affordance | **High** |
| **No contextual tips** | Features like weighting, filtering, and significance testing are undiscoverable | Medium |
| **Workspace empty state is generic** | "Upload a file" — no value proposition or example data | Medium |
| **No skeleton loading states** | Tables show spinners instead of structured skeletons | Medium |
| **No "What's New" or changelog** | Users who return after updates have no signal of new capabilities | Low |

**What Great Looks Like:**
- **Figma** uses a "Get started" checklist with 3-4 high-value first actions, each with a micro-demo
- **Arc Browser** built its entire brand on a theatrical onboarding that teaches by doing
- **Displayr** uses template-driven first runs: "Start with a banner table" or "Explore key driver analysis"

**Creative Solutions:**
1. **Guided First Analysis** — On first dataset load, a non-blocking spotlight tour highlights: (1) drag a variable to rows, (2) drag to columns, (3) notice the significance markers. Each step is dismissible and replayable from Help.
2. **Smart Empty Canvas** — When no variables are placed, the canvas shows a large, animated drop-zone illustration with the dataset's top 5 "interesting variables" (highest variance, most balanced distribution) as suggested starting points.
3. **Example Dataset + Walkthrough** — Ship with a curated "Tutorial Dataset" (small, clean, with an embedded walkthrough). Users can follow along with a pre-built analysis deck that teaches concepts.
4. **Contextual Micro-Tips** — After a user performs an action 3+ times, show a subtle "Did you know?" chip (e.g., "Press `W` to toggle weighting" or "Right-click a chart bar to create a segment").
5. **Skeleton Screens** — Replace loading spinners with skeleton tables that match the expected row/column structure, reducing perceived load time.

---

### 3.3 Information Density & Visual Hierarchy: Cluttered in the Wrong Places

**Current State:** The Canvas has good structure but the information hierarchy could be sharper. The sidebar is dense, the shelf area competes with the canvas, and table typography doesn't guide the eye effectively.

**Specific Gaps:**

| Gap | Example | Severity |
|-----|---------|----------|
| **Sidebar variable list is visually flat** | All variables look similar; no visual weight for key vs. derived variables | Medium |
| **Shelf area dominates** | Row/column/weight shelves take significant vertical space even when empty | Medium |
| **Crosstab typography is undifferentiated** | Row labels, cell values, totals, and significance markers all have similar weight | Medium |
| **No "focus mode"** | Users cannot hide chrome to focus on the analysis table/chart | Medium |
| **Filter bar is noisy** | Active filters are prominent even when not being edited | Low |
| **Timeline dock competes for attention** | Film-strip rail at bottom draws eye away from canvas | Low |

**What Great Looks Like:**
- **Linear** reduces navigation to near-invisibility when you're working — the sidebar dims, tabs compact, and the content area owns the visual field
- **Bloomberg Terminal** achieves extreme density through ruthless typographic hierarchy: monospace data, bold labels, color-coded meaning, zero decorative elements
- **Q Research Software** (market research competitor) uses a "document" metaphor where each analysis is a page with clear title → table → chart → annotation flow

**Creative Solutions:**
1. **Adaptive Shelf Collapse** — Empty shelves collapse to a single subtle line with a `+` icon. When a variable is dragged near, they expand with a spring animation. This gives the canvas more breathing room by default.
2. **Typographic Hierarchy in Tables** — Introduce a clear type scale for crosstabs:
   - Row category labels: `--font-body`, `--text-base`, `font-semibold`
   - Cell values: `--font-mono`, `--text-sm`, tabular nums
   - Totals: `--font-mono`, `--text-sm`, `font-bold`, muted color
   - Significance markers: distinct but small (superscript style)
   - Column headers: `--font-body`, `--text-sm`, uppercase, letter-spacing
3. **Focus Mode** — A `F` keyboard shortcut or button that hides the sidebar, shelves, and timeline, expanding the slide to full viewport. A thin floating toolbar holds essential actions.
4. **Variable List Visual Weight** — In the sidebar, derived/recoded variables get a subtle "derived" badge (small chain link icon). The active row/column variables get a colored left border matching their shelf. Weight variables get a scale icon.
5. **Timeline Dock Redesign** — Make the timeline more like a "film strip" — smaller by default, expanding on hover. Current slide is clearly indicated; others recede in opacity. Section dividers are more architectural.

---

### 3.4 Theme System: Three Themes, One Incomplete

**Current State:** Soft Machine and Mission Control are mature. Liquid Glass exists in code but feels underdeveloped in actual usage. No dark variants for Soft Machine or Liquid Glass.

**Specific Gaps:**

| Gap | Example | Severity |
|-----|---------|----------|
| **Liquid Glass is not fully realized** | Material tokens exist but many components don't use them; blur performance untested | Medium |
| **No dark Soft Machine** | Users who like warm aesthetics but work at night have no option | Medium |
| **No accessibility themes** | High-contrast, colorblind-safe, and reduced-motion themes missing | Medium |
| **Theme preview is absent** | Users must switch themes to see them; no preview thumbnail | Low |
| **Hardcoded shadows in `index.css`** | `rgba(0,0,0,...)` values evade CI because `index.css` is exempt from token checks | Low |

**What Great Looks Like:**
- **Arc Browser** has themes that feel like personalities — each one changes not just colors but mood, with dynamic backgrounds
- **VS Code** has hundreds of community themes plus built-in accessibility themes (High Contrast, HC Light)
- **Linear** auto-generates themes from a base + accent + contrast variable using LCH color space

**Creative Solutions:**
1. **Liquid Glass Maturity** — Commit to Liquid Glass as a "presentation mode." Add a dynamic gradient mesh background (subtle, animating slowly) that lives behind frosted panels. Test `backdrop-filter` performance on mid-range hardware and provide a "reduced effects" fallback.
2. **Auto-Generated Dark Variants** — Use LCH color space (like Linear) to programmatically generate dark variants of Soft Machine and Liquid Glass. This ensures perceptual lightness consistency.
3. **Theme Preview Cards** — In the theme switcher, show mini preview cards (3×2cm rectangles) rendering a sample crosstab and chart in each theme's colors.
4. **Accessibility Theme Pack** — Add:
   - **High Contrast** (WCAG AAA, 7:1 minimum)
   - **Deuteranopia-Safe** (blue-yellow instead of red-green for significance markers)
   - **Reduced Motion** (not just fewer animations, but a calmer palette with less visual vibration)
5. **Shadow Token Fix** — Replace all hardcoded `rgba(0,0,0,...)` in `index.css` with semantic shadow tokens (`--shadow-sm`, `--shadow-md`, etc.) that themes can override.

---

### 3.5 Data Visualization: Correct but Not Delightful

**Current State:** Charts are fully tokenized and support 15 types. But the default styling is utilitarian. Chart interactivity (hover states, tooltips, transitions) is basic.

**Specific Gaps:**

| Gap | Example | Severity |
|-----|---------|----------|
| **Chart transitions are jarring** | Switching chart types causes an instant re-render | Medium |
| **Tooltips are basic HTML** | No smooth follow-cursor animation, no rich formatting | Medium |
| **No chart annotation layer** | Cannot add callouts, highlights, or text annotations to charts | Medium |
| **Hover states are minimal** | Bars darken slightly; no glow, no scale, no cross-highlighting of legend | Low |
| **No "small multiples" view** | For multi-response grids, each sub-variable must be viewed separately | Low |
| **Chart type selector is icon-only** | 15 icons in a toolbar — some are ambiguous without labels | Low |

**What Great Looks Like:**
- **Observable Plot** uses smooth morphing transitions between chart types (bar → line → area)
- **Flourish** allows rich annotations: arrows, callout boxes, trend lines drawn directly on charts
- **Tableau** has best-in-class tooltips: multi-line, conditional formatting, and action buttons

**Creative Solutions:**
1. **Chart Morphing** — Use D3's `generalUpdatePattern` with `interpolate` to morph between chart types. A bar chart's bars should grow/shrink into line points, not disappear and reappear.
2. **Rich Tooltip System** — Tooltips should be floating cards (not basic `title` attributes) with:
   - The value + percentage
   - Significance vs. column/row
   - Action buttons: "Filter to", "Exclude", "Create Group"
   - Smooth spring-follow animation
3. **Annotation Layer** — Allow users to add text callouts, arrows, and highlight regions directly on charts. Store annotations in the slide state. This is a huge differentiator for presentation decks.
4. **Chart Type Selector Redesign** — Group chart types by purpose (Comparison, Distribution, Relationship, Proportion) with labeled sections and a small preview thumbnail of each type using sample data.
5. **Small Multiples Mode** — For multi-response variables, offer a "Grid View" that renders mini charts for each sub-variable in a responsive grid. Each mini chart is clickable to expand.

---

### 3.6 Micro-Interactions & Feedback: Missing the "Tactile" Layer

**Current State:** Basic hover states exist. But there's a lack of intermediate feedback for operations that take time or have side effects.

**Specific Gaps:**

| Gap | Example | Severity |
|-----|---------|----------|
| **No operation progress for engine calls** | `isQuerying` shows a spinner but no sense of progress or stage | Medium |
| **Drag ghost is plain** | Dragging a variable shows default browser ghost, not a themed card | Medium |
| **No haptic/audio feedback** | Operations complete silently; no sense of "done" | Low |
| **Copy/export actions lack confirmation** | Exporting PPTX gives no "Saved" toast or download indicator | Low |
| **Filter chips don't show impact** | Adding a filter doesn't visually indicate how many rows were excluded | Low |
| **No undo/redo visual feedback** | Users can't see what changed after undo | Low |

**What Great Looks Like:**
- **Superhuman** has obsessive micro-interaction design: every action has sound, motion, and confirmation
- **Linear** shows inline progress indicators for async operations with stage labels ("Uploading…", "Processing…", "Done")
- **Figma** uses a floating toast stack for all operations with undo actions

**Creative Solutions:**
1. **Operation Toast Stack** — A bottom-right toast system for:
   - "Analysis complete — 2,340 rows, 4 significance markers"
   - "Deck exported to Downloads"
   - "Variable recoded — 3 values mapped"
   - Each toast has an undo button where applicable.
2. **Custom Drag Ghost** — Use `@dnd-kit`'s `DragOverlay` to render a themed, semi-transparent variable card with a subtle drop shadow that follows the cursor with spring physics.
3. **Filter Impact Indicator** — When a filter is applied, the filter chip shows the row count change ("−1,240 rows") with a brief animation. A tooltip shows the exact filter expression.
4. **Query Progress Stages** — Break `isQuerying` into stages: "Building SQL…" → "Computing frequencies…" → "Running significance tests…" → "Rendering…". Show a multi-step progress indicator.
5. **Undo History Visual** — A subtle "last action" indicator in the status bar: "Recoded `age` → `age_group`" with an undo button.

---

### 3.7 Accessibility: Fundamentally Underinvested

**Current State:** WCAG AA is documented as a goal but not systematically enforced. Focus states exist but are basic. Screen reader support is partial.

**Specific Gaps:**

| Gap | Example | Severity |
|-----|---------|----------|
| **No `prefers-reduced-motion`** | Already flagged in §3.1 | **High** |
| **No `prefers-contrast: high`** | No high-contrast mode | **High** |
| **Focus indicators are inconsistent** | Some elements have 2px accent outline, others have browser default | Medium |
| **Table navigation is not screen-reader optimized** | Crosstab cells lack `scope`, `headers`, and descriptive `aria-label` | Medium |
| **Color alone conveys significance** | Red/green arrows for significance are not distinguishable by shape + color | Medium |
| **No keyboard shortcuts reference** | Users must discover shortcuts; no `?` help panel | Low |
| **D3 charts are not accessible** | SVG charts lack `role="img"`, `aria-label`, and keyboard navigation | Low |

**Creative Solutions:**
1. **Accessibility Theme + Settings Panel** — Add a dedicated accessibility section in settings:
   - Motion: Reduce / Eliminate
   - Contrast: Default / High / Maximum
   - Colorblind: None / Deuteranopia / Protanopia / Tritanopia
   - Font size: Base / Large / Extra Large
2. **Accessible Charts** — Generate hidden HTML tables (`sr-only`) alongside D3 charts for screen readers. Add `aria-label` to each bar/segment describing the value.
3. **Keyboard Shortcut Reference** — `?` key opens a modal cheat sheet with all shortcuts, grouped by context (Global, Canvas, Manager, Timeline).
4. **Significance Marker Redesign** — Use both color AND shape: ▲ for higher, ▼ for lower, ● for neutral. Colorblind users can distinguish by shape.
5. **Focus Ring System** — Ensure every interactive element has a consistent, visible focus ring. Use `:focus-visible` (not `:focus`) to avoid showing rings on mouse click.

---

### 3.8 Competitive Differentiation: What Velocity Could Own

**The Opportunity:** Velocity competes with Displayr, Q Research, and SPSS — tools that are powerful but visually dated and cloud-dependent. Velocity's local-first, browser-native architecture is unique. The UI should *scream* this advantage.

**What Velocity Could Own:**

1. **"Instant" Feel** — Because everything is local, operations that take seconds in Displayr happen in milliseconds in Velocity. The UI should emphasize this speed through motion (quick springs, snappy transitions) and feedback ("Computed in 12ms" micro-copy).

2. **Privacy-First Visual Language** — A subtle visual motif (shield icon, local storage indicator, "Your data never leaves this device" reassurance) that reinforces the local-first promise.

3. **Deck-as-Document** — The Analysis Deck is Velocity's most distinctive feature. It should feel like a polished presentation tool (think Keynote) embedded in an analysis workspace. Slide transitions, presenter notes, and layout grids should be first-class.

4. **Semantic Intelligence Surface** — The semantic layer (auto-annotation, concept discovery, suggestions) is advanced but invisible. The UI should surface this intelligence: "This looks like an NPS variable — want to see the top-2-box summary?"

---

## 4. Research Insights: What Best-in-Class Tools Do

### 4.1 Linear (Project Management / Dense Data UI)

**Key Learnings:**
- **LCH color space for themes** — Perceptually uniform; auto-generates variants from 3 variables (base, accent, contrast)
- **Dev toolbar for design iteration** — They built a color picker inside the app to iterate on tokens live
- **Density without clutter** — Navigation recedes; content takes precedence; borders are softened
- **Motion as functional signal** — Animations guide attention, not decorate

**Applicable to Velocity:**
- Migrate theme generation to LCH for automatic dark variants and accessibility themes
- Build a dev-only theme tuner (or even user-facing theme builder)
- Apply "content first" density: dim sidebar when user is working on canvas

### 4.2 Arc Browser (Radical Reimagining of Chrome)

**Key Learnings:**
- **Theatrical onboarding** — First-run is an experience that teaches by doing, not reading
- **Command palette as primary navigation** — `Cmd+T` is not a tab, it's a command palette
- **Vertical tabs + spaces** — Reorganizes information architecture to match mental models

**Applicable to Velocity:**
- Command palette (`Cmd+K`) for variable search, action invocation, and navigation
- Theatrical first-run: upload → analyze → export in a guided flow
- Reconsider sidebar organization: could variables be organized by "space" (topic) rather than flat list?

### 4.3 Displayr / Q Research (Direct Competitors)

**Key Learnings:**
- **Document metaphor** — Analysis lives in a page/document that flows vertically
- **Template-driven starting points** — Users don't start blank; they pick an analysis type
- **Automated insight highlighting** — Significance is not just marked but *explained*

**Applicable to Velocity:**
- Template gallery in workspace: "Start with Banner Table", "Key Driver Analysis", "Trend Report"
- Insight explanations: not just "significantly higher" but "significantly higher than the base (p < 0.05, n=1,240)"
- Consider a "report" view that stacks slides vertically for reading/export

### 4.4 Notion (Modular Document Tool)

**Key Learnings:**
- **Slash commands** — `/` brings up contextual actions; zero UI chrome needed
- **Block-based architecture** — Everything is a block that can be moved, transformed, or referenced
- **Progressive disclosure** — New features appear as suggestions, not clutter

**Applicable to Velocity:**
- Slash commands in slide titles/notes: `/significance` to add a significance explanation block
- Block-based slides: a slide is a stack of blocks (title, table, chart, annotation, callout)
- Progressive feature discovery: after N uses, suggest advanced features

### 4.5 Figma (Design Tool / Canvas Model)

**Key Learnings:**
- **Infinite canvas with frames** — The canvas is infinite; frames (slides) are placed on it
- **Properties panel** — Contextual right panel shows properties of selected element
- **Multiplayer cursors** — Presence indicators build sense of shared space

**Applicable to Velocity:**
- Consider an infinite canvas mode where slides are placed freely, not just in a timeline
- Properties panel for selected variable: show distribution, metadata, and actions in a right panel
- (Future) Multiplayer cursors for collaboration

---

## 5. Creative Solutions: The Big Ideas

### 5.1 The "Velocity Canvas" — Infinite Canvas Mode (Phase 5+)

Instead of a single-slide view with a timeline, offer an **infinite canvas** where slides are placed like artboards. Users can:
- Pan and zoom across their analysis
- See relationships between slides (arrow connections)
- Create "dashboard walls" for stakeholder presentations
- Group slides into sections visually

**Why it matters:** This is how modern design tools (Figma, FigJam) and emerging BI tools (Miro for data) work. It matches how researchers actually think — spatially and relationally.

### 5.2 The "Insight Engine" — Automated Narrative Layer

Build a panel that generates plain-language insights from the current analysis:

> "Younger respondents (18-34) are significantly more likely to prefer Option A than the overall sample (68% vs 52%, p<0.01). This pattern is consistent across all three waves."

- One-click "Add to slide as annotation"
- MCP tool for agents to consume
- Exportable as speaker notes in PPTX

**Why it matters:** This bridges the gap between statistical output and stakeholder communication. It's what Displayr charges $2,699/year for.

### 5.3 The "Command Palette" — Universal Action Surface

`Cmd+K` opens a fuzzy-searchable command palette:
- "Filter to males" → applies filter
- "Weight by income" → sets weight variable
- "Export deck" → triggers export
- "Find NPS variables" → semantic search
- "Dark mode" → switches theme

**Why it matters:** Power users never reach for the mouse. A command palette makes every feature accessible in <2 keystrokes.

### 5.4 The "Living Slide" — Real-Time Data Connection

Slides can be set to "live" mode where:
- Data refreshes when the underlying dataset updates (new wave imported)
- Significance markers update automatically
- A "last computed" timestamp shows freshness
- Stale slides get a subtle warning badge

**Why it matters:** For longitudinal studies, researchers rerun the same analysis across waves. Living slides eliminate manual duplication.

### 5.5 The "Semantic Suggestions" — Intelligence Overlay

When a user selects a variable, show contextual suggestions:
- "This is a Likert scale. Try a diverging bar chart."
- "High missingness (34%). Consider a 'Don't know' group."
- "Correlates strongly with `income` (r=0.72). Add to analysis?"
- "Similar to 'Brand Awareness Q3' in Wave 2. Harmonize?"

**Why it matters:** The semantic layer already exists. Surfacing it as suggestions makes Velocity feel like a research assistant, not just a tool.

---

## 6. Prioritization Matrix

| Initiative | Impact | Effort | Phase | Dependencies |
|-----------|--------|--------|-------|-------------|
| **Unified Motion DSL + reduced motion** | High | Low | Phase 4 follow-through | None |
| **Accessible charts + focus system** | High | Medium | Phase 4 follow-through | None |
| **Smart empty states + canvas guidance** | High | Medium | Phase 4 follow-through | None |
| **Toast/feedback layer** | High | Low | Phase 4 follow-through | None |
| **Typographic hierarchy in tables** | High | Low | Phase 4 follow-through | None |
| **Theme shadow token fix** | Medium | Low | Phase 4 follow-through | None |
| **Command palette (`Cmd+K`)** | High | Medium | Phase 5 | None |
| **Chart morphing + rich tooltips** | Medium | High | Phase 5 | D3 expertise |
| **Liquid Glass maturity** | Medium | Medium | Phase 5 | Performance testing |
| **Dark variants (auto-generated)** | Medium | Medium | Phase 5 | LCH color migration |
| **Annotation layer on charts** | High | High | Phase 5 | Slide state changes |
| **Insight Engine (narrative)** | High | High | Phase 5 | NLP / template system |
| **Infinite canvas mode** | High | Very High | Phase 6 | Architecture changes |
| **Living slides** | High | High | Phase 6 | WebSocket/polling layer |
| **Semantic suggestions overlay** | High | Medium | Phase 6 | Semantic layer API |

**Recommended Next 3 Sprints:**

1. **Sprint A: Motion & Accessibility Foundation**
   - Unified Motion DSL
   - `prefers-reduced-motion` support
   - Accessible focus rings + chart ARIA
   - Toast/feedback layer

2. **Sprint B: Canvas Polish**
   - Smart empty states
   - Adaptive shelf collapse
   - Typographic hierarchy in tables
   - Focus mode

3. **Sprint C: Theme & Density**
   - Shadow token fix
   - Theme preview cards
   - Variable list visual weight
   - Command palette (MVP: search + actions)

---

## 7. Design Principles for the Next Phase

To guide all future UI work, establish these principles:

1. **Content is King** — Chrome (sidebars, shelves, docks) should recede when not actively used. The analysis output owns the visual field.

2. **Every Pixel Has a Purpose** — No decorative elements. Every color, shadow, and animation communicates state, hierarchy, or relationship.

3. **Speed is a Feature** — Local-first speed should be *felt* through snappy animations, instant feedback, and progress transparency.

4. **Intelligence is Invisible Until Needed** — Semantic suggestions, insights, and recommendations appear contextually, not as persistent UI clutter.

5. **Accessibility is Not a Mode** — Accessibility features (reduced motion, high contrast, screen reader support) are core to the design, not bolted-on afterthoughts.

6. **Progressive Disclosure** — New and advanced features are discovered naturally through usage, not presented all at once.

---

## 8. Conclusion

Velocity's UI is at an inflection point. The architecture is solid, the features are comprehensive, and the design system is disciplined. The path from "good" to "great" is not about adding major new surfaces — it's about **crafting the existing surfaces with obsessive attention to detail**.

The highest-impact, lowest-effort wins are:
1. **Motion system unification** (1 week)
2. **Smart empty states** (1 week)
3. **Toast/feedback layer** (3 days)
4. **Table typographic hierarchy** (3 days)
5. **Accessibility pass** (1-2 weeks)

These alone would elevate the product perceptibly. The bigger bets — Command Palette, Insight Engine, Infinite Canvas — should follow once the foundation is polished.

**The goal:** When a researcher opens Velocity, they should feel like they're using software that *understands* research — not just software that *enables* it.
