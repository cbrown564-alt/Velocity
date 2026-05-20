# Visual Polish Vision — From "Looks Great" to "Feels Inevitable"

**Date:** May 19, 2026  
**Updated:** May 19, 2026  
**Focus:** User-centric delight, instrumental beauty, and the psychology of data trust  
**Builds on:** `visual-polish-review.md` (UXP-001 through UXP-032)  
**Evidence:** Live UI screenshots (`S11-canvas-1920.png`, `S11-workspace-1920.png`), design system docs (`design_01_system.md`), component code  
**Status:** §9 Quick Wins implemented — see §10. VP-D-01–09 validated on 4176; UXP-033–035 fixed May 20; §12 frame-it **Yes** (human re-test) — see `visual-polish-delight-validation-plan.md`.  

---

## 1. The Premise: Why "Looks Great" Is Not Enough

The `visual-polish-review.md` correctly identifies that Velocity's primary output—the crosstab table—must graduate from "assembled from good parts" to "intentionally designed." It proposes alignment fixes, typography consistency, and spatial audits. These are necessary. They are also **hygiene**.

This document asks a harder question:

> **What would make a researcher choose Velocity not because it works, but because it feels like an extension of their intellect?**

We are not optimizing for screenshots. We are optimizing for **moments**:
- The moment a significant finding reveals itself and the interface confirms it before the user finishes reading the number.
- The moment a stakeholder sees the table and trusts it instantly, without knowing why.
- The moment a researcher uses Velocity for three hours straight and feels energized, not drained.

That is delight. That is the gap between "looks great" and "feels inevitable."

---

## 2. Research: What Makes Data Interfaces Delightful?

### 2.1 Domain Research: Survey Tools and the "Trust Threshold"

Survey data analysis occupies a unique UX position. Users are not exploring data for fun—they are looking for **evidence** to support or destroy a hypothesis. The interface must communicate:
1. **Authority:** This number is correct.
2. **Transparency:** You can see how it was derived.
3. **Discovery:** There might be something you haven't noticed yet.

Competitive analysis reveals:

| Product | Delight Mechanism | Velocity Gap |
|:---|:---|:---|
| **Displayr / Q** | Bases (`n=`) are always visible; column grids are geologically stable. | `n=` now always visible via `CrosstabCell` (Strategy B, UXP-001). Small-base warning added for `n < 30`. |
| **Qualtrics StatsIQ** | Significance is automatic and visually prominent—users feel "smart" without doing math. | Our sig markers are small arrows that compete with other cyan accents. |
| **Apple Numbers** | Tables feel like **objects** with weight and finish. Borders are intentional, not structural glue. | Analysis Frame quick win applied: table now has `bg-[var(--bg-panel)]` + `border-[var(--border-subtle)]` + `rounded-lg`. |
| **Bloomberg Terminal** | Density is so extreme that alignment becomes the only way to survive. Every pixel is load-bearing. | Column Guide quick win applied: hover on any column draws a vertical `border-color-active` rule from header through cells. |
| **Linear** | Redesign focused on "visual alignment, hierarchy, and density"—noise reduction as a feature. | We still have competing panel borders, ghost gutters, and mixed case systems. |

### 2.2 Case Studies: Learning from Products That Nailed It

#### Case Study A: Spotify's "Good Morning" (The Human Touch in Data)

Spotify's ML-powered "Shortcuts" feature had a naming problem. A/B tests were inconclusive. The solution: a time-based greeting ("Good Morning") that made an algorithmic recommendation feel **human and personal**. The result was not just higher engagement—it created **affective trust**: users felt the app *knew* them.

**Lesson for Velocity:** Data tables are cold by default. A crosstab says "47.7%." A story-aware interface could say "Male respondents in the East are significantly under-represented"—and let the user edit that into the title. The delight is not the automation; it's the **invitation to narrate**.

#### Case Study B: Linear's Redesign (The Power of Subtraction)

Linear's 2024 redesign did not add features. It "adjusted the sidebar, tabs, headers, and panels to reduce visual noise, maintain visual alignment, and increase the hierarchy and density of navigation elements." The result feels timeless because every element justifies its existence.

**Lesson for Velocity:** Our Canvas has app bg → SmartCanvas padding → panel border → table (UXP-022). That is three layers of containment before the user sees data. Linear's redesign teaches us to **flatten the spatial stack** and let the content be the frame.

#### Case Study C: Asana's Celebration Creatures (Micro-Delight with Purpose)

Asana shows tiny animated creatures when users complete tasks. This is not frivolous—it creates **positive reinforcement loops** around otherwise mundane actions. The delight is proportional to the action: small action, small reward.

**Lesson for Velocity:** Finding a statistically significant result is the research equivalent of completing a task. It deserves a **micro-acknowledgment**—not confetti, but a subtle, dignified confirmation that says "this finding is real."

#### Case Study D: Apple Numbers (Objecthood and Materiality)

Numbers tables have a specific quality of **objecthood**: they feel like things you could pick up. This comes from consistent border treatment, deliberate corner radii, and a header band that reads as a distinct material layer. The table is not just data; it is an **artifact**.

**Lesson for Velocity:** Our table is borderless inside a panel (UXP-023). It needs to become an object with its own material properties—especially in Liquid Glass, where the table should feel like a frosted sheet floating above the gradient mesh.

---

## 3. The Delight Framework: Five Pillars for Velocity

Drawing from the research, we propose five pillars that go beyond the polish rubric (Anchoring, Rhythm, Honesty, Restraint, Presentation):

| Pillar | Question | Velocity Expression |
|:---|:---|:---|
| **Instrumentality** | Does every visual choice communicate statistical meaning? | Animations that show "settling" rather than "appearing." |
| **Objecthood** | Does the table feel like a crafted artifact, not a layout? | Consistent frame, material borders, distinct header band. |
| **Affective Trust** | Does the interface make the user feel confident and smart? | Always-visible bases, narrative suggestions, clear significance. |
| **Responsive Density** | Does the interface adapt its density to the user's mental mode? | Exploration mode (dense) vs. Presentation mode (generous). |
| **Material Honesty** | Does each theme have a coherent physical metaphor? | Mission Control = flight instruments; Soft Machine = research journal; Liquid Glass = holographic display. |

---

## 4. Bold Ideas: The Delight Layer

These ideas build on UXP-001–032 but push into experiential territory. They are organized by pillar.

---

### 4.1 Instrumentality: Animations That Mean Something

#### Idea 1: "The Settling Scale" (Cell Entry Animation)

**Problem:** When crosstab data loads, cells fade in uniformly. A percentage is either there or not. But a percentage is a **conclusion**—it implies a calculation has settled.

**Solution:** When cells first render, the number counts up (or down) to its final value over ~400ms, like a scale finding its balance. The `framer-motion` infrastructure already exists.

- **Frequency cells:** Count from 0% to final %. The decimal resolves last.
- **Metric cells:** The mean value slides in; the SD appears a beat later (100ms delay), communicating "primary finding first, uncertainty second."
- **Significance markers:** They don't just appear—they "lock in" with a subtle scale-bounce (overshoot + settle). Stronger significance = firmer settle.

**Why this delights:** It mirrors the researcher's own cognitive process: "Let's see what the data says... ah, there it is." The animation is not decoration; it is **explanation**.

**Implementation note:** Use `framer-motion` with `type: "spring", stiffness: 300, damping: 20`. Add a `prefers-reduced-motion` fallback to instant display. This respects the existing `useReducedMotion` hook.

---

#### Idea 2: "The Column Guide" (Interactive Scanline)

**Problem:** UXP-001 demands that a stakeholder can draw a straight vertical line from "EAST" through 47.7% and 52.3%. This is a static test. But alignment is also a **dynamic exploration tool**.

**Solution:** On column hover (already implemented as `hoveredCol`), draw a faint vertical rule (1px, `var(--border-grid)` at 30% opacity) connecting the header through every cell in that column to the footer statistics. In Mission Control, extend the existing cyan scanline concept: the row scanline + column guide form a **crosshair** that says "you are here."

- **Mission Control:** Cyan crosshair with subtle glow.
- **Soft Machine:** Warm gray column guide with a coral dot at the header intersection.
- **Liquid Glass:** The guide is a translucent "ridge" that catches light, like a physical groove in glass.

**Why this delights:** It transforms passive alignment into an **interactive instrument**. The user doesn't just see that the numbers align; they feel the column as a unit.

---

### 4.2 Objecthood: The Table as Artifact

#### Idea 3: "The Analysis Frame" (Unified Output Container)

**Problem:** UXP-004 and UXP-023 note that charts have padding and borders while tables are borderless inside panels. There is no shared "output frame."

**Solution:** Create an `AnalysisOutputFrame` component that wraps both chart and table outputs. It provides:
1. **A title band:** Consistent height, distinct background (`var(--bg-panel)` or theme material), containing the slide title + subtitle.
2. **A content well:** The table or chart lives here, with theme-appropriate padding.
3. **A footer band:** Statistics status bar and methodology notes, visually separated by a top border.

The frame should feel like a **single sheet of material**:
- **Mission Control:** Matte black aluminum. Sharp edges. Data is etched on.
- **Soft Machine:** Heavy cream paper. Slight shadow suggests thickness. Borders feel like printed rules.
- **Liquid Glass:** A frosted pane with specular highlights. Content appears to be *under* the glass, not on it.

**Why this delights:** It solves the "nested panels" problem (UXP-022) not by removing borders but by **elevating the table to an object**. When a user screenshots Velocity, they are photographing an artifact, not a window.

---

#### Idea 4: "The Trust Anchor" (Base Visibility as Design Element)

**Problem:** UXP-001 implementation (Strategy B) makes `n=` visible but treats it as secondary text. In research, the base size is not secondary—it is **foundational**. Hiding it (even on hover) communicates shame about sample size.

**Solution:** Redesign the cell so that the base `n` is an integral part of the cell's visual mass:
- **Layout:** Primary value (%) top, base `n` bottom-left, always visible.
- **Typography:** `n=` uses `text-[10px] font-mono tracking-tight` but sits on a consistent baseline across all cells in a row.
- **Zero/missing cells:** Instead of showing "0%" with a faded `n=0`, show an **em-dash** (—) with a subtle "no data" indicator (a tiny dot or dash). This is more honest than a zero.
- **Total column:** Use the exact same `CrosstabCell` component. No special markup path. The total shows `52.4%` + `n=131` just like every other cell.

**Advanced:** For very small bases (`n < 30`), add a subtle amber warning tint to the base number—not alarming, just a whisper of "interpret with caution."

**Why this delights:** Transparency builds trust. When a user can scan down a column and instantly see that every percentage is backed by a real count, they relax. The interface is not hiding anything.

---

### 4.3 Affective Trust: Making Users Feel Smart

#### Idea 5: "The Insight Halo" (Peripheral Significance)

**Problem:** Significance markers (arrows, letters) are small and inline. They compete with the percentage for attention. Users must actively look for them.

**Solution:** Create a subtle **glow or gradient** in the cell background for significant findings. This lives in the periphery of vision, guiding the eye without requiring reading.

- **High significance (95%):** A very subtle green tint (`var(--color-success)` at 5% opacity) behind the cell. In Mission Control, a faint cyan luminescence.
- **Directional significance (80%):** An even subtler gray tint, just enough to differentiate from the background.
- **No significance:** Pure background. Clean. Unmarked.

The key is **restraint**: the tint should be visible only when you look for it, not when you're reading the number. It should feel like **heat** radiating from the data, not like a highlighter.

**Why this delights:** It inverts the discovery model. Instead of "I wonder if this is significant?" the user thinks "I see something glowing—what is it?" The interface guides discovery.

---

#### Idea 6: "The Story Shelf" (Narrative Microcopy)

**Problem:** Slide titles default to "gender by region." This is a database query, not a finding. Users leave it because writing titles is work.

**Solution:** When a crosstab loads, generate a **suggested narrative title** based on the most striking finding:
- If a cell is significantly higher than expected: "Male respondents are over-represented in the West"
- If no significance: "Gender distribution is relatively even across regions"
- If strong chi-square: "Region is a significant predictor of gender response"

Display this as a **ghosted suggestion** in the title field, using `text-[var(--text-secondary)] italic`. The user can:
- Click to accept it (it becomes the real title).
- Start typing to replace it.
- Ignore it (it fades after 3 seconds).

**Why this delights:** It teaches users how to tell stories with data. It transforms Velocity from a "table generator" into a "findings assistant." The emotional payoff is the feeling of **authorship**: the user edits the suggestion into their own voice.

---

### 4.4 Responsive Density: Adapting to Mental Mode

#### Idea 7: "Focus Breathing" (Adaptive Density)

**Problem:** The table has one density setting. But users have two modes: **exploration** (scanning many tables quickly) and **presentation** (showing one table to stakeholders).

**Solution:** The table should "breathe" based on context:
- **Exploration mode (default):** Compact. `n=` visible but small. Sig markers inline. Footer minimal. Row height ~36px.
- **Presentation mode (triggered by Focus/Fullscreen or user toggle):** Generous. Row height ~48px. `n=` slightly larger. Cell values have more whitespace. Footer expands to show full methodology. The title band becomes more prominent.

**Transition:** When switching modes, the table rows animate their height with a spring transition. Numbers don't reflow—they just get more breathing room.

**Why this delights:** The interface respects the user's cognitive state. Dense when they need speed; spacious when they need clarity. It feels **empathetic**.

---

### 4.5 Material Honesty: Pushing the Three Themes

Each theme has a "signature detail" (scanline, accent bar, glass blur). These can be deepened into coherent **material systems**.

#### Idea 8: Mission Control — "Flight Instrument System"

**Current:** Dark theme, cyan scanline on hover.

**Push further:**
- **Phosphor persistence:** When a cell value updates (e.g., after filtering), the old value fades out over 200ms while the new value fades in. Like a CRT refresh.
- **Grid lines as graticule:** The table grid should feel like the crosshatch on a flight display—functional, not decorative. Use `var(--border-grid)` at higher contrast. Column guides (Idea 2) become the primary navigation metaphor.
- **Alert hierarchy:** Small bases or uncertain data get an amber "caution" treatment (not red—red is for errors). This mirrors aviation UI where amber = monitor, red = act now.
- **Monospace discipline:** All numbers, headers, and even row labels should feel like they belong on the same instrument panel. The existing mono font is good—extend it to the Total row counts (UXP-011).

**Why this delights:** The user feels like a pilot, not a passenger. The data is not presented *to* them; it is *reported* to them by a reliable system.

---

#### Idea 9: Soft Machine — "The Research Journal"

**Current:** Warm panels, coral accent bar on hover, large radius.

**Push further:**
- **Paper texture:** Add a subtle CSS noise texture (`noiseOpacity: 0.03`) to panel backgrounds. Not visible at a glance, but perceptible on long sessions as "warmth."
- **Ink density hierarchy:** Primary text = "fresh ink" (high opacity, slightly heavier weight). Secondary text = "faded ink" (`text-secondary` at 70% opacity, not 100%).
- **Margin notes:** The variable shelf labels ("COLUMNS", "ROWS") currently feel like UI chrome. Redesign them as **margin labels**—left-aligned, smaller, in a muted color, like handwritten section headers in a notebook. Align them with the slide title for one vertical rhythm (UXP-021).
- **Hand-drawn borders:** Use `border-color` that is slightly desaturated and 1px—like a printed rule, not a digital line. The existing `border-grid` token is close; make it subtly warmer.

**Why this delights:** The interface feels like a **crafted object**—something a researcher might leave on their desk and feel proud of. It invites extended, thoughtful use.

---

#### Idea 10: Liquid Glass — "Holographic Display"

**Current:** Translucent panels, backdrop blur, large radius.

**Push further:**
- **Depth as hierarchy:** The table should float above the background mesh on a distinct z-layer. Use a deeper shadow and a subtle gradient overlay on the table surface to suggest thickness.
- **Specular cell highlights:** On hover, cells don't just change background—they catch light. A subtle radial gradient (white at 5% opacity, center-top) suggests a light source above the glass.
- **Refracted typography:** Text on Liquid Glass should feel like it's *under* the surface. Slightly increase letter-spacing and use a lighter font weight to suggest depth. The existing SF Pro Text is good—use it at `font-weight: 400` for body, `300` for display.
- **Frosted footer:** The statistics footer should be more frosted than the table body, creating a visual "ground plane" that the table rests on.

**Why this delights:** Liquid Glass is the riskiest theme because translucency exposes misalignment (UXP-032). But if executed with real material logic, it becomes the most **magical**—the data feels like it's floating in space, ready to be manipulated.

---

## 5. The Micro-Delight Register

Small moments that cost little to implement but pay dividends in affective response:

| Trigger | Delight Moment | Theme Treatment |
|:---|:---|:---|
| **First significant finding** | Subtle pulse of the sig marker + status bar updates with a "tick" animation | MC: cyan blink; SM: coral warmth; LG: light refraction ripple |
| **Filter applied** | Row counts update with a counting animation; removed rows fade out | MC: phosphor fade; SM: ink drying; LG: dissolve |
| **Drag-and-drop variable** | The variable "snaps" into the shelf with a satisfying magnetic pull | All themes: spring physics via framer-motion |
| **Slide created** | New slide thumbnail slides in from the right, pushing others | MC: telemetry scroll; SM: page turn; LG: layer settle |
| **Export complete** | Brief checkmark morph in the export button | All themes: shared spring checkmark |
| **Zero/empty state** | Not a sad blank page—a **suggested starting point** with gentle animation | MC: standby mode; SM: blank page invitation; LG: floating prompt |

---

## 6. Relationship to Existing UXP Register

This vision **extends** the UXP register rather than replacing it. Mapping:

| UXP Item | How This Vision Takes It Further |
|:---|:---|
| **UXP-001** (Cell alignment) | Adds "Column Guide" (Idea 2) and "Settling Scale" (Idea 1) to make alignment dynamic and meaningful. |
| **UXP-002** (Column widths) | Becomes part of "Analysis Frame" (Idea 3) with proportional width system. |
| **UXP-003** (Total row) | "Trust Anchor" (Idea 4) unifies total and data cells; "Focus Breathing" (Idea 7) gives totals room in presentation mode. |
| **UXP-004** (Slide chrome) | "Analysis Frame" (Idea 3) is the implementation. |
| **UXP-005** (Statistics footer) | Footer becomes a distinct "band" in the frame; micro-animations on update. |
| **UXP-010–012** (Typography) | "Research Journal" (Idea 9) and "Flight Instrument" (Idea 8) give typography thematic purpose beyond consistency. |
| **UXP-020** (Opacity-0 audit) | "Trust Anchor" (Idea 4) eliminates hover-reveal for bases entirely. |
| **UXP-022–023** (Nested panels) | "Analysis Frame" (Idea 3) is the unifying solution. |
| **UXP-030–032** (Theme polish) | Ideas 8–10 push each theme from "style" to "material system." |

---

## 7. Suggested Implementation: `STAB-UI-D` (Delight Layer)

Proposed as a workstream **after** `STAB-UI-P` (Visual Polish) stabilizes the table grammar.

### Phase 1: Foundation (2–3 weeks)
1. **Analysis Frame** (Idea 3) — Extract `AnalysisOutputFrame` from `SlideContainer` and `DataTable`.  
   *Quick win done: outer `motion.div` now has `bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg shadow-sm`.*
2. **Trust Anchor** (Idea 4) — Finalize `CrosstabCell` base visibility; eliminate `opacity-0` gutters.  
   *Quick win done: `n=` always visible; `smallBaseClass()` warns on `n < 30` via `var(--status-warning-text)`.*
3. **Column Guide** (Idea 2) — Add hover vertical rule to `DataTable`.  
   *Quick win done: `th` and `td` in hovered column switch left border to `var(--border-color-active)`; no layout shift.*

### Phase 2: Animation (2 weeks)
4. **Settling Scale** (Idea 1) — Add entry animations to `CrosstabCell` with `framer-motion`.
5. **Focus Breathing** (Idea 7) — Add density toggle + responsive row heights.
6. **Micro-delight register** — Implement export, filter, and DnD micro-animations.

### Phase 3: Intelligence (2–3 weeks)
7. **Insight Halo** (Idea 5) — Add subtle cell background tints for significance.
8. **Story Shelf** (Idea 6) — Build narrative title generator (can start simple: rule-based, not ML).
9. **Theme Material Systems** (Ideas 8–10) — Deepen each theme's CSS/material tokens.

### Out of Scope
- ML-generated narrative titles (start with rule-based heuristics).
- Sound design (keep visual-only for now).
- Full 3D/Liquid Glass shader effects (defer to WebGL phase).

---

## 8. Validation: The "Would You Frame It?" Test

The ultimate validation for a data interface:

> **Would a researcher screenshot this table, paste it into a presentation, and feel proud—not because it proves their point, but because it looks like evidence?**

**Validated May 20, 2026 (human reviewer):** **Yes** for Mission Control crosstab + chart (post UXP-033–035 re-test on `vp-d-05/01`, `vp-d-06/05-chart-theme-mc`).

First pass was **No** (same day, pre-polish): multi-hue chart (UXP-033), footer χ² prominence (UXP-034), orange small-base `n=` (UXP-035). All three fixed before re-test.

Current state: Delight layer **validated** for MC hero output — screenshot-ready without cropping.

After `STAB-UI-P`: Yes, without red circles (table grammar) — separate track.

That is the standard.

---

## 9. Quick Wins (This Week)

All three quick wins were implemented on May 19, 2026.

### 9.1 ✅ Make `n=` always visible + small-base warning (Idea 4, minimal version)
**Files:** `src/features/dashboard/components/CrosstabCell.tsx`, `CrosstabCell.test.tsx`
- `n=` was already visible via Strategy B (UXP-001); this change **enhances** it.
- Added `smallBaseClass(n)` helper: when `0 < n < 30`, the base count renders in `var(--status-warning-text)` (theme-aware amber).
- Applied to both `frequency` and `metric` variants.
- Tests: 2 new assertions verify `data-small-base` attribute presence/absence.

### 9.2 ✅ Add the Column Guide (Idea 2, minimal version)
**File:** `src/features/dashboard/components/DataTable.tsx`
- Column headers (`th`) now carry `border-l` always (transparent by default).
- On `hoveredCol === col`, both `th` and `td` switch left border to `var(--border-color-active)`.
- No `::after` pseudo-element needed—reuses existing Tailwind border system.
- Zero layout shift because `border-l` width is constant; only color changes.

### 9.3 ✅ Unify the Analysis Frame (Idea 3, minimal version)
**File:** `src/features/dashboard/components/DataTable.tsx`
- Changed outer `motion.div` from `bg-transparent border-none` to `bg-[var(--bg-panel)] border border-[var(--border-subtle)]`.
- Table now reads as a distinct **card/artifact** inside the Canvas panel.
- Rounded corners (`rounded-lg`) and subtle shadow preserved; `overflow-hidden` clips scroll content cleanly.

### 9.4 Validation
- **Tests:** `CrosstabCell.test.tsx` 5/5 passed; all dashboard component tests 31/31 passed.
- **TypeScript:** Clean (`tsc --noEmit`).
- **Perceptual delta:** The table no longer bleeds into the panel; hovering a column creates an immediate "instrument-grade" vertical guide; small bases whisper caution without breaking scan flow.

---

## 10. Execution Log

| Date | Item | Commit | Notes |
|:---|:---|:---|:---|
| 2026-05-19 | Quick Wins 1–3 | — | `CrosstabCell.tsx` + `DataTable.tsx` + tests. See §9. |
| 2026-05-19 | Phase 2: Settling Scale | — | `AnimatedNumber.tsx` + `CrosstabCell.tsx` count-up/spring animations; `DataTable.tsx` `animationKey` trigger; `useReducedMotion` gating. 13 tests passing. |
| 2026-05-19 | Phase 2: Focus Breathing | — | `uiSlice.ts` `tableDensity` state; `DashboardShell.tsx` toggle + focus-mode auto-switch; `DataTable.tsx`/`SlideContainer.tsx` responsive padding. 26 tests passing. |
| 2026-05-19 | Phase 2: DnD Micro-delight | — | `DashboardShell.tsx` `DragOverlay` spring drop animation + `color-mix` shadow via semantic tokens. |
| 2026-05-19 | Phase 3: Insight Halo | — | `--halo-high`/`--halo-mid` tokens in `index.css` (theme-aware: MC gets cyan); `DataTable.tsx` `haloClass()` applied to data cells; 2 component tests. |
| 2026-05-19 | Phase 3: Story Shelf | — | `generateNarrativeTitle.ts` + `generateNarrativeTitleFromRows.ts` rule-based generators; `SlideHeader.tsx` ghosted suggestion with 3s auto-dismiss + click-to-accept; 9 unit + 4 component tests. |
| 2026-05-19 | Phase 3: Theme Material Systems | — | Soft Machine paper-texture SVG noise + ink-density + warmer borders; Mission Control graticule grid + amber caution glow; Liquid Glass specular cell highlights + refracted typography + frosted footer. |
| 2026-05-20 | Validation recon (VP-D-00) | — | Browser eval blocked: OPFS lock on 4174; blank viewport after row var on 4175/4176. Plan: `visual-polish-delight-validation-plan.md`. |
| 2026-05-20 | §12 Frame-it (human) | — | **No** on MC crosstab + chart; UXP-033–035 / UXR-049–051. Re-test after visual hierarchy fixes. |
| 2026-05-20 | UXP-033–035 polish pass | — | MC sequential chart palette; demoted χ² when p ≥ 0.05; whisper small-base `n=`. Refreshed `vp-d-05/01`, `vp-d-06/05-chart-theme-mc`. |
| 2026-05-20 | §12 Frame-it re-test (human) | — | **Yes** on MC crosstab + chart post-polish. STAB-UI-D delight layer validated. |
| 2026-05-20 | Validation VP-D-09 (stretch surfaces) | — | Workspace card + timeline dock + Manager overlay × SM/MC/LG; `screenshots/vp-d-09/`. |
| 2026-05-20 | Validation VP-D-08 (theme matrix) | — | Statistics footer + export modal × SM/MC/LG on 4176; `screenshots/vp-d-08/`. |
| 2026-05-20 | Validation VP-D-07 (Manager) | — | D-040–042 on 4176; `screenshots/vp-d-07/`. UXR-018 fixed via `managerSearchQuery`. |
| 2026-05-20 | Validation VP-D-06 (chart) | — | D-030–031 on 4176; `screenshots/vp-d-06/`. Chart lacks stats footer band; VP-D-08 + §12 remain. |
| 2026-05-20 | Validation VP-D-01–05 (crosstab) | — | P1–P10, D-001–024 on 4176; `screenshots/vp-d-01` … `vp-d-05`. Manager, theme matrix (footer/export), §12 frame-it remain. |

---

*End of vision document. This is a living artifact—iterate as prototypes validate or invalidate the emotional hypotheses above. Multi-session validation tracked in `visual-polish-delight-validation-plan.md`.*
