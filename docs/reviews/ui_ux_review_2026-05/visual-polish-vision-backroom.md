# Visual Polish Vision — The Back Room: Variable Manager, Workspace & Onboarding

**Date:** May 19, 2026
**Updated:** May 19, 2026
**Focus:** Instrumental beauty for data gardening, library wayfinding, and first-run trust
**Builds on:** `visual-polish-vision-delight.md` (Five Pillars), `visual-polish-review.md` (UXP-001–032), session notes 00–12
**Evidence:** `session-04-variable-manager.md` (J5), `session-01-workspace.md` (J1/J2), `session-00-recon.md` (cold load), `findings.md` (UXR-000–048)
**Status:** Quick wins §9.1–9.4 Done (2026-05-19); Phases 1–4 Done (2026-05-21). Aligns with tracker `STAB-UI-E` (Back-Room Delight).

---

## 1. The Premise: The Back Room Deserves Front-Row Design

The `visual-polish-vision-delight.md` asks what makes a researcher choose Velocity because it *feels inevitable*. It answers brilliantly for the **output** — the crosstab table, the chart, the analysis frame. The Settling Scale, the Insight Halo, the Story Shelf: these are delights of **production**.

But a researcher does not live in the output. They live in the **back room**:
- They spend hours in the **Variable Manager**, cleaning, coding, recoding — turning raw survey responses into analyzable categories.
- They return repeatedly to the **Workspace**, their research library, where they choose which dataset to open, which project to continue, which wave to compare.
- They experience the **Onboarding** only once, but that once determines whether they ever see the crosstab at all.

> **The back room is where trust is built or destroyed.** A beautiful crosstab cannot save a researcher who quit during their first upload because the progress bar lied (UXR-036). A Story Shelf cannot help a researcher who dreads opening the Variable Manager because it feels like a spreadsheet from 2003.

This document asks:

> **What would make the back room feel not like a chore, but like a craft?**

The crosstab vision optimized for **moments of revelation**. This vision optimizes for **rhythms of practice** — the repeated, cumulative interactions that make a tool feel like an extension of the researcher's hand.

---

## 2. Research: What Makes "Back Room" Interfaces Delightful?

### 2.1 Domain Research: The Psychology of Data Gardening

Survey researchers perform three back-room jobs that are cognitively demanding and emotionally unrewarding:

1. **Data grooming:** Cleaning, recoding, handling missing values. No glory; must be done right.
2. **Library curation:** Organizing datasets, waves, projects. The cost of disorganization is finding the wrong file at the wrong time.
3. **Tool adoption:** Learning a new interface under deadline pressure. Every moment of confusion is a moment of panic.

| Product | Back-Room Delight | Velocity Gap |
|:---|:---|:---|
| **RStudio Environment Pane** | Variables are not a list but a **diagnostic panel** — type, sample values, dimensions at a glance. | Our Variable Manager lists variable sets but does not surface "data health" without drilling into Inspector. |
| **Apple Photos Library** | Smart albums auto-organize; the library feels **alive**, not archival. | Workspace cards show static metadata; no "recent analysis" or "unfinished business" surfacing. |
| **Notion Onboarding** | The blank page is not empty — it is a **template invitation**. The user starts *doing*, not *learning*. | Our empty state says "Upload your first dataset" (good) but does not guide the first analysis step. |
| **Things 3** | Project organization uses **physical metaphors** (areas, projects, tasks) that map to mental models. | Our Projects tab is literally blank (UXR-008). No mental model is offered. |
| **Apple Health** | Data quality is not hidden; it is **celebrated** ("100% stand hours"). Completeness feels like achievement. | Our Inspector shows missing counts as raw numbers. No "data health score" or quality framing. |

### 2.2 Case Studies: Learning from the Best Back Rooms

#### Case Study A: Things 3 — The Power of Physical Organization

Things 3 does not have "folders." It has **Areas** (broad life domains), **Projects** (outcomes), and **Tasks** (actions). The hierarchy maps to how humans actually think about work. Moving a task from "Someday" to "Today" is not a status change; it is a **physical relocation** with spring animation.

**Lesson for Velocity Workspace:** Datasets are not files; they are **waves of inquiry**. A longitudinal study is not a folder; it is a **timeline**. The workspace should offer mental models — "Active Analyses," "Draft Datasets," "Published Findings" — that match how researchers think about their work, not how computers store files.

#### Case Study B: Lightroom — The Catalog as Craft Bench

Lightroom's Library module is where photographers spend most of their time. It is not a file browser; it is a **craft bench**. Collections, smart collections, flags, ratings, and color labels let photographers build **personal taxonomies** without moving files. The grid view shows not just thumbnails but **activity traces** — edited, unedited, rejected.

**Lesson for Velocity Variable Manager:** Variables are not rows in a table; they are **materials for analysis**. The Manager should let researchers build **analysis-ready collections** ("Demographics," "Attitudinal scales," "Key dependent variables") and see at a glance which variables have been "processed" (recoded, grouped, labeled) and which are still "raw."

#### Case Study C: Figma's First Run — Invitation, Not Instruction

Figma's onboarding does not start with a tutorial. It starts with a **file that is already interesting** — a demo project with real design work. The user learns by *doing*, not by reading. Tooltips appear contextually, only when the user hovers over the relevant control.

**Lesson for Velocity Onboarding:** The Load Example button is the right instinct, but it can go further. The first dataset should arrive with a **pre-built story** — not just "here is gender and region" but "here is a significant finding waiting to be discovered." The user's first action should feel like *uncovering*, not *building*.

#### Case Study D: Apple Health — Data Quality as Affirmation

Apple Health does not say "7,234 steps recorded, 266 missing." It says "92% daily goal achieved." The framing transforms data completeness from a **deficit** into an **achievement**.

**Lesson for Velocity Inspector:** A variable with 5% missing values is not "incomplete"; it is "95% complete." The Inspector should frame data quality **positively**, using color and language that makes the researcher feel like a good steward, not a negligent one.

---

## 3. The Back-Room Framework: Five Pillars, Back-Room Expression

The Five Pillars from the crosstab vision (Instrumentality, Objecthood, Affective Trust, Responsive Density, Material Honesty) apply to the back room — but their expression changes.

| Pillar | Crosstab Expression | Back-Room Expression |
|:---|:---|:---|
| **Instrumentality** | Animations that show "settling." | Actions that show "consequence" — every edit, recode, or organization produces visible, immediate feedback. |
| **Objecthood** | Table as crafted artifact. | Dataset as **living object**; variable as **diagnostic instrument**; project as **timeline artifact**. |
| **Affective Trust** | Always-visible bases, narrative suggestions. | Always-visible data health, progressive disclosure of complexity, no silent failures. |
| **Responsive Density** | Exploration vs. presentation mode. | **Manager:** compact list vs. diagnostic dashboard. **Workspace:** grid vs. timeline. **Onboarding:** guided vs. freeform. |
| **Material Honesty** | Flight instrument / research journal / holographic display. | Same themes, different surfaces: MC = **mission control console**; SM = **field research station**; LG = **spatial data workspace**. |

---

## 4. Bold Ideas: The Back-Room Delight Layer

### 4.1 Variable Manager: The Data Console

#### Idea 1: "Variable Vitals" (Data Health at a Glance)

**Problem:** The Variable Manager lists variable sets as plain text rows. To know if a variable is "good" (complete, properly labeled, widely used), the researcher must open the Inspector. This is like a doctor having to open a separate app to see a patient's heart rate.

**Solution:** Every variable set row becomes a **vital-sign strip** — a compact, glanceable summary of data health:
- **Completeness arc:** A tiny 8px SVG arc showing % complete (green = >95%, amber = 80–95%, red = <80%). Not a progress bar; an **indicator light**.
- **Type icon with state:** The existing type icon (Tag, BarChart2, etc.) gains a subtle "processed" halo if the variable has been recoded or grouped.
- **Usage sparkline:** A 1px-high horizontal bar showing how often this variable appears in the current deck's slides. Unused = faint; heavily used = bright.
- **Label quality dot:** A tiny dot color-coded by whether all values have human-readable labels. Green = fully labeled; amber = some raw codes; red = mostly raw.

**Theme treatments:**
- **Mission Control:** Vitals read like flight instrument LEDs — precise, minimal, no decoration.
- **Soft Machine:** Vitals read like marginalia in a field notebook — hand-drawn arcs, warm ink.
- **Liquid Glass:** Vitals float as translucent badges, their opacity encoding intensity.

**Why this delights:** The researcher scans the Manager and immediately sees which variables need attention. It transforms the Manager from a **phone book** into a **diagnostic console**.

**Implementation note:** Use existing `variableStats` and `transformLog` data; no new engine queries. The usage sparkline derives from `slidesSlice` row/col variable references.

---

#### Idea 2: "The Living Inspector" (Cross-Surface Cross-Highlighting)

**Problem:** The Inspector already has chart ↔ table cross-highlighting for categorical variables. But this power is trapped inside the Inspector. The Manager list, the Canvas sidebar, and the Inspector itself operate in isolation.

**Solution:** Create a **shared hover state** that connects all three surfaces:
- **Hover a variable in the Manager list:** The Canvas sidebar subtly highlights that variable (if present in the current dataset). A tooltip shows: "Used in 2 slides" or "Not yet used."
- **Hover a variable in the Canvas sidebar:** The Manager list scrolls to and highlights that variable (if open). The Inspector, if visible, previews that variable without selecting it.
- **Hover a value in the Inspector's distribution chart:** The corresponding row in the value-mapping table highlights (already implemented). Extend this: if that variable is on a slide, the relevant cell in the crosstab subtly pulses.

**Theme treatments:**
- **Mission Control:** Cyan cross-surface "telemetry link" — a faint line (SVG overlay) briefly connects the hovered element to its remote counterpart.
- **Soft Machine:** Warm coral "thread" — like a piece of yarn connecting related items in a research board.
- **Liquid Glass:** Light refraction — the remote element catches a specular highlight, as if illuminated by the hover.

**Why this delights:** The interface feels **omniscient**. The researcher thinks "what about gender?" and the interface answers everywhere at once. It breaks down the silos between management, exploration, and analysis.

---

#### Idea 3: "Smart Facets" (From Filter to Insight)

**Problem:** The faceted search bar (Type / Status / Quality) is functional but passive. It filters; it does not **inform**. A researcher looking at "Incomplete" variables sees a list but gets no sense of *why* they are incomplete or *what to do about it*.

**Solution:** Transform facets into **actionable insight cards**:
- **Type facet:** Not just a dropdown but a **type distribution mini-bar** (5px bars showing counts of each type). Clicking a bar filters to that type.
- **Quality facet:** Shows "3 variables incomplete" as a badge. Clicking it opens a **batch-fix suggestion**: "Auto-label 12 missing value labels?" or "3 numeric variables have >10% missing — consider binning?"
- **Status facet:** "2 hidden variables" with a one-click "Unhide all" action.

**Theme treatments:**
- **Mission Control:** Facets read like **system status alerts** — amber for attention, green for all-clear.
- **Soft Machine:** Facets read like **field notes** — "3 variables need attention" in handwritten-style microcopy.
- **Liquid Glass:** Facets are **floating control orbs** that expand on hover into radial menus.

**Why this delights:** The interface stops being a **tool** and starts being a **collaborator**. It notices problems and offers solutions. The researcher feels supported, not alone.

---

#### Idea 4: "The Recode Chronicle" (Transform as Narrative)

**Problem:** When a researcher recodes a variable, the new variable appears in the list with a "grouped" badge. But the *story* of what was done — "Male + Female → Gender Binary," "Age 18-24, 25-34 → Young" — is hidden in the Inspector or lost in the `transformLog`.

**Solution:** Every derived variable carries a **visual lineage** — a tiny, always-visible "family tree" showing its origin:
- In the Manager list: a small "branch" icon next to derived variables. Hovering shows the parent variable name and the transformation type.
- In the Inspector: a "Lineage" section above the distribution chart, showing the parent variable, the transformation rule, and a "Revert" action.
- In the Canvas sidebar: derived variables are visually grouped under their parent with an indent and a subtle connecting line.

**Theme treatments:**
- **Mission Control:** Lineage reads like a **system log** — timestamped, precise, immutable.
- **Soft Machine:** Lineage reads like **revision history** — crossed-out old labels, handwritten new ones.
- **Liquid Glass:** Lineage is a **depth stack** — parent variables appear "behind" derived ones, with parallax on scroll.

**Why this delights:** Data transformation is the most error-prone part of survey analysis. Making lineage visible and beautiful makes it **auditable** and **reversible**. The researcher feels safe to experiment.

---

### 4.2 Workspace: The Research Library

#### Idea 5: "Dataset Portraits" (From Card to Character)

**Problem:** Workspace cards show rows, columns, file size, and a generic sparkline. They are informative but **anonymous**. A researcher with 12 datasets cannot tell at a glance which one contains the analysis they were working on yesterday.

**Solution:** Each dataset card becomes a **portrait** — visually distinctive and semantically rich:
- **Color signature:** Derived from the dataset's variable type distribution (more categorical = warmer; more numeric = cooler). Not random; **meaningful**.
- **Activity heatmap:** A tiny 7×3 grid (7 days × 3 sessions/day) showing when the dataset was last accessed. Brighter = more recent. This is the "pulse" of the dataset.
- **Slide thumbnail:** Instead of a generic sparkline, show a **tiny preview of the most recent slide** — a 60×40px miniature crosstab or chart. If the deck is empty, show the variable shelf silhouette.
- **Session state badge:** "5 slides, last edited 2h ago" — not just saved, but **actively worked on**.

**Theme treatments:**
- **Mission Control:** Portraits read like **mission patches** — bold, geometric, information-dense.
- **Soft Machine:** Portraits read like **polaroids on a corkboard** — slightly rotated, taped corners, warm tones.
- **Liquid Glass:** Portraits are **floating crystals** — each dataset refracts light differently based on its "data density."

**Why this delights:** The workspace becomes a **memory palace**. The researcher does not read metadata; they *recognize* the dataset by its visual character. Finding the right file becomes instant.

---

#### Idea 6: "The Project Timeline" (Longitudinal Studies as Stories)

**Problem:** The WaveTimeline component exists but is underutilized. Projects with multiple waves are shown as cards with a timeline inside, but the **narrative potential** of longitudinal data is untapped.

**Solution:** Elevate the timeline from a sub-component to a **first-class workspace view**:
- **Wave comparison preview:** Hovering a wave shows a **miniature delta view** — "+12 variables vs. Wave 1," "Response rate 78% (↓5%)."
- **Trend sparklines:** Each wave shows a tiny trend line of a key variable (e.g., overall satisfaction) across all waves, if harmonized.
- **Gap warnings:** Missing waves in a sequence are shown as **ghosted placeholders** with "Upload Wave 3" CTA.
- **Harmonization status:** A "harmony ring" around the project card — complete = solid color; partial = dashed; none = absent.

**Theme treatments:**
- **Mission Control:** Timelines read like **launch sequences** — T-minus counting, stage separations, mission milestones.
- **Soft Machine:** Timelines read like **field season journals** — "Wave 1: Spring 2024" with handwritten annotations.
- **Liquid Glass:** Timelines are **temporal depth** — older waves recede into blur; the current wave is sharp and forward.

**Why this delights:** Longitudinal researchers are storytellers by nature. A beautiful timeline does not just organize data; it **tells the story of the study**. The workspace becomes a **museum of the research journey**.

---

#### Idea 7: "Ambient Search" (Finding Without Looking)

**Problem:** Workspace search is literal — type "mock", get "mock_data.csv". But researchers often think in **concepts**, not filenames: "the dataset with NPS," "last week's analysis," "the UK wave."

**Solution:** Enhance search with **ambient intelligence**:
- **Semantic hints:** As the user types, show not just matching datasets but **suggested filters**: "Showing 3 datasets with 'satisfaction' variables" or "2 projects with longitudinal data."
- **Recent context:** If the user searched for "gender" in the Manager last session, the workspace search suggests: "Continue exploring gender in mock_data?"
- **Visual filters:** Instead of tabs (Recent / Starred / Projects / All), use **dynamic category chips** that appear based on what's in the workspace: "2 Longitudinal," "3 Unanalyzed," "1 With session."

**Theme treatments:**
- **Mission Control:** Search is **telemetry query** — precise, filtered, result-count prominent.
- **Soft Machine:** Search is **librarian's assistance** — "Ah, you might also like..."
- **Liquid Glass:** Search is **spatial query** — results float closer as they match; non-matches drift back.

**Why this delights:** The workspace stops being a **file cabinet** and starts being a **research assistant**. The researcher finds what they need before they finish asking.

---

### 4.3 Onboarding: The First Conversation

#### Idea 8: "The Guided First Finding" (Progressive Disclosure)

**Problem:** The empty state is good — Upload vs. Load Example is clear. But after Load Example, the user sees an empty Canvas with suggested variables. They must still **choose** and **drag** to see anything meaningful. The first "aha!" moment is delayed.

**Solution:** Create a **guided first-analysis path** that automates the first crosstab and highlights the significance:
1. **User clicks Load Example.** The dataset loads.
2. **A gentle spotlight** animates to the suggested variables area: "This dataset has 7 variables. Let's explore two that tell a story."
3. **Velocity auto-populates** a meaningful first crosstab (e.g., gender × region, or satisfaction × segment) — not random, but chosen for visual clarity and likely significance.
4. **The Story Shelf appears immediately** with a pre-generated narrative: "Satisfaction varies significantly by region."
5. **The user sees the Insight Halo** glowing on significant cells.
6. **A contextual tooltip** appears: "This glow means the difference is statistically significant. Try dragging another variable to see what changes."

The user has experienced **four delight features** within 30 seconds, without reading documentation.

**Theme treatments:**
- **Mission Control:** Guided path is **pre-flight checklist** — each step confirmed with a subtle chime (visual, not audio) and status update.
- **Soft Machine:** Guided path is **mentor's introduction** — warm, encouraging, with "Well done" microcopy at each step.
- **Liquid Glass:** Guided path is **spatial tour** — the camera (viewport focus) gently pans from variable shelf to canvas to significance legend.

**Why this delights:** The user's first emotion is not "I need to learn this tool" but "I just found something interesting." The tool becomes invisible; the data becomes visible.

---

#### Idea 9: "The Confidence Builder" (Error as Guidance)

**Problem:** Upload errors, import failures, and unsupported formats are silent or opaque (UXR-021, UXR-036). The empty state says "nothing is ever uploaded to a server" — but if the upload fails, the user has no reassurance.

**Solution:** Transform every error state into a **confidence-building moment**:
- **Upload progress:** The decorative progress bar (UXR-036) becomes a **genuine, byte-accurate progress indicator** with stage labels: "Reading file..." → "Parsing variables..." → "Building index..." → "Ready."
- **Format detection:** If a user uploads a `.xlsx`, the interface does not say "Unsupported." It says: "Excel files need to be saved as CSV first. Here's how." with a **one-click conversion guide**.
- **Partial import warnings:** If 3 rows fail to parse out of 10,000, show: "9,997 rows imported successfully. 3 rows had formatting issues — view them?" Not alarm; **transparency**.
- **OPFS lock:** Instead of "Storage Issue," show: "This dataset is open in another tab. Switch to that tab or close it to open here."

**Theme treatments:**
- **Mission Control:** Errors are **status reports** — factual, unemotional, actionable.
- **Soft Machine:** Errors are **gentle corrections** — "It looks like..." rather than "Error:..."
- **Liquid Glass:** Errors are **soft barriers** — the interface dims but does not crash; a floating card offers the path forward.

**Why this delights:** Trust is built not when things go right but when things go wrong. A graceful error recovery makes the user feel **the tool has their back**.

---

#### Idea 10: "The Returning Researcher" (Progressive Re-onboarding)

**Problem:** After a week away, a researcher returns to Velocity. They see their workspace — but they've forgotten where they were. The deck state is restored, but the **context** is lost.

**Solution:** Create a **return ritual** that reorients the returning researcher:
- **"Welcome back" card:** After >3 days away, a subtle card appears at the top of the workspace: "You were analyzing satisfaction × region in mock_data. Resume?" with a one-click "Open last session."
- **Deck summary tooltip:** Hovering a dataset with a saved session shows a **3-bullet summary**: "5 slides · gender, region, NPS · Last filter: Age > 35."
- **Change log:** If variables were recoded or datasets added since last visit, a subtle "What's new" dot appears on the Manager button, with a tooltip: "2 new grouped variables since your last visit."

**Theme treatments:**
- **Mission Control:** Return ritual is **mission briefing** — "Last known position: slide 3, gender×region."
- **Soft Machine:** Return ritual is **returning to the desk** — "Your notes are where you left them."
- **Liquid Glass:** Return ritual is **spatial reorientation** — the workspace gently animates to show what changed since last visit.

**Why this delights:** The interface remembers not just data but **context**. The researcher feels recognized. The tool respects their time.

---

## 5. The Back-Room Micro-Delight Register

Small moments, back-room specific:

| Trigger | Delight Moment | Theme Treatment |
|:---|:---|:---|
| **Variable recoded** | New derived variable "slides in" from parent with a connecting branch animation | MC: system log entry; SM: ink flow; LG: cell division |
| **Dataset uploaded** | Card "materializes" in workspace with a settle animation; sparkline draws itself | MC: telemetry received; SM: photo developing; LG: crystal formation |
| **Project created** | Project card expands from selected datasets with color "flowing" from children | MC: mission patch minted; SM: binder assembled; LG: constellation connected |
| **First significance found** | Subtle "pulse" on the Insight Halo + Story Shelf appears with a typewriter effect | MC: target acquired; SM: discovery noted; LG: revelation |
| **Manager search yields 1 result** | Result "spotlights" with a gentle zoom; "Clear search" appears as a soft whisper | MC: target lock; SM: found it; LG: focus pull |
| **Facet reduces list to zero** | Not "No results" but "All variables match — try narrowing?" with suggested facet values | MC: all systems nominal; SM: everything's here; LG: clear view |
| **Inspector stats load** | Distribution chart "grows" from baseline; bars rise like a tuning orchestra | MC: sensors online; SM: sketch taking shape; LG: data crystallizing |
| **Bulk action applied** | Affected rows briefly "flash" confirmation, then settle to new state | MC: batch executed; SM: stamps applied; LG: wave propagation |

---

## 6. Relationship to Existing UXR / UXP Register

This vision **extends** the remediation register. Mapping:

| UXR/UXP Item | How This Vision Takes It Further |
|:---|:---|
| **UXR-006** (`0 B` file size) | "Dataset Portraits" (Idea 5) replace static metadata with living, accurate indicators. |
| **UXR-007** (No "no results" copy) | "Ambient Search" (Idea 7) provides contextual emptiness messaging. |
| **UXR-008** (Projects tab blank) | "Project Timeline" (Idea 6) fills the Projects tab with longitudinal storytelling. |
| **UXR-018** (Manager search leaks to Canvas) | "Living Inspector" (Idea 2) turns the leak concept into intentional cross-surface linking. |
| **UXR-019** (Facet dropdown a11y) | "Smart Facets" (Idea 3) restructures facets as action cards, improving a11y tree exposure. |
| **UXR-020** (Value-mapping actions unnamed) | "Variable Vitals" (Idea 1) contextually label actions based on hovered value. |
| **UXR-036** (Decorative upload progress) | "Confidence Builder" (Idea 9) makes progress genuine and stage-labeled. |
| **UXR-037** (Silent crosstab failures) | "Confidence Builder" (Idea 9) surfaces all engine failures with explanation + recovery. |
| **UXP-022–023** (Nested panels) | "Dataset Portraits" (Idea 5) unify card chrome into single material objects. |
| **UXP-030–032** (Theme polish) | All ideas define theme-specific treatments that deepen material systems beyond the table. |

---

## 7. Suggested Implementation: `STAB-UI-E` (Back-Room Delight)

Proposed as a workstream **after** `STAB-UI-A/B/C` (Visual Polish sprints, now Done) and alongside or after tracker `STAB-UI-D` (UI/UX review remediation). Renamed from `STAB-UI-B` to avoid collision with tracker `STAB-UI-B` (Canvas Polish, Done).

### Phase 1: Diagnostic Layer (2–3 weeks)
1. **Variable Vitals** (Idea 1) — Add completeness arc, processed halo, usage sparkline, label dot to `VariableSetColumn` rows.
2. **Smart Facets** (Idea 3) — Restructure `FacetedSearchBar` into insight cards with distribution mini-bars and batch-fix suggestions.
3. **Inspector Stats Load Animation** (Micro-delight) — `InspectorDistribution` bars animate from baseline on data arrival.

### Phase 2: Connection Layer (2 weeks)
4. **Living Inspector** (Idea 2) — Shared hover state across Manager, Canvas sidebar, and Inspector. Use existing store + event bus; no new engine dependencies.
5. **Recode Chronicle** (Idea 4) — Add lineage visualization to derived variables in Manager list and Inspector.
6. **Cross-surface telemetry link** (Theme MC) / **thread** (SM) / **refraction** (LG) — SVG overlay or CSS custom property coordination.

### Phase 3: Library Layer (2–3 weeks)
7. **Dataset Portraits** (Idea 5) — Replace `MiniSparkline` with activity heatmap + slide thumbnail + color signature.
8. **Project Timeline** (Idea 6) — Elevate `WaveTimeline` to first-class workspace view with delta previews and harmonization rings.
9. **Ambient Search** (Idea 7) — Semantic hints + dynamic category chips in `WorkspaceView` search.

### Phase 4: Onboarding Layer (2 weeks)
10. **Guided First Finding** (Idea 8) — Auto-populate first crosstab after Load Example with spotlight tour.
11. **Confidence Builder** (Idea 9) — Genuine upload progress, format detection, graceful error recovery.
12. **Returning Researcher** (Idea 10) — Welcome-back card, deck summary tooltip, change log dot.

### Out of Scope
- ML-powered semantic dataset search (start with variable-name keyword matching).
- Full longitudinal trend analysis (harmonization UI exists; trend sparklines need pre-harmonized data).
- Sound design or haptics.
- Video tutorials (keep text/tooltip-based for now).

---

## 8. Validation: The "Would You Return?" Test

The crosstab vision asks: "Would you frame it?" The back-room vision asks a complementary question:

> **Would a researcher open Velocity on a Monday morning, see their workspace, and feel *glad* to be back — not because the tool is new, but because it remembers them?**

And for onboarding:

> **Would a researcher who has never used survey software before finish their first session feeling like they *found something*, not like they *learned something*?**

**Validation criteria by surface:**

| Surface | Validation Question | Method |
|:---|:---|:---|
| Variable Manager | Can a researcher scan the list and identify which 3 variables need attention in <5 seconds? | Timed task + eye-tracking (or click-path analysis) |
| Inspector | Does the distribution chart load feel like "data arriving" or "data appearing"? | Perceptual survey (1–5 scale) |
| Workspace | Can a researcher with 10 datasets find the one they worked on yesterday without reading filenames? | Recognition task vs. recall task |
| Onboarding | Does a first-time user produce a significant crosstab within 60 seconds? | Time-to-first-finding metric |
| Error recovery | After a failed upload, does the user successfully retry within 30 seconds? | Recovery time metric |

---

## 9. Quick Wins (This Week — Candidate List)

These are minimal interventions that deliver disproportionate delight:

### 9.1 Variable Vitals — Minimal Version (Idea 1)
**File:** `src/features/variableManager/VariableSetColumn.tsx`
- Add a 6px colored dot to each variable set row indicating label quality:
  - Green: all values labeled
  - Amber: some raw codes
  - Red: no labels
- Use existing `variable.valueLabels` data; zero new queries.
- No layout shift: dot sits in existing row padding.

### 9.2 Inspector Load Animation — Minimal Version (Micro-delight)
**Files:** `InspectorDistribution.tsx`, `HorizontalBarRenderer.tsx`, `VerticalBarRenderer.tsx`, `HistogramRenderer.tsx`, `src/lib/chartBarEntrance.ts`
- On `stats` arrival, distribution bars **grow from baseline** over 300ms (staggered 25ms per bar).
- Vertical/column/histogram bars: `scaleY` 0→1, `transform-origin: bottom center`.
- Horizontal bars: `scaleX` 0→1, `transform-origin: left center` (same “data arriving” read).
- Gated on `useReducedMotion`; replays when `variable.id` + stats change (`chartKey` remount).

### 9.3 Workspace Dataset Card — Activity Dot (Idea 5, minimal)
**File:** `src/features/workspace/components/WorkspaceView.tsx` (`DatasetCard`)
- Add a "last opened within 24h" pulse dot to the card corner. Uses existing `lastOpenedAt`.
- CSS animation: `pulse` keyframe, 2s cycle, theme-aware accent color.
- Single class addition; no state changes.

### 9.4 Onboarding — Auto-First-Crosstab (Idea 8, minimal)
**File:** `src/features/dashboard/hooks/useSuggestedVariables.ts` + `src/features/dashboard/components/SlideContainer.tsx`
- After Load Example, if deck is empty and this is the first session (no `sessionState` in profile), auto-populate the first slide with the highest-confidence suggested pair (gender × region, or first categorical × second categorical).
- Show a one-time toast: "We started your first analysis. Drag a new variable to explore further."
- Flag in `uiSlice`: `hasSeenAutoCrosstab` — never repeat.

---

## 10. Execution Log

| Date | Item | Commit | Notes |
|:---|:---|:---|:---|
| 2026-05-19 | 9.1 Variable Vitals (minimal) | — | Added 6px label-quality dot to `VariableSetColumn` rows (`VariableSetColumn.tsx`, `MillerColumns.module.css`). Green = all values labeled; amber = partial; red = none. Uses existing `valueLabels` + `variableStats` with zero new engine queries. |
| 2026-05-19 | 9.2 Inspector Load Animation | — | Wrapped `InspectorDistribution` chart containers in `framer-motion` entrance animation (`opacity` + `y` translation, 300ms, gated on `useReducedMotion`). Keyed on `variable.id + stats` so animation replays on data arrival. |
| 2026-05-19 | 9.3 Workspace Activity Dot | — | Added `activityDot` pulse animation to `DatasetCard` (`WorkspaceView.tsx`, `WorkspaceView.module.css`). Appears when `lastOpenedAt` is within 24h. CSS `@keyframes activityPulse`, theme-agnostic `var(--color-accent)`. |
| 2026-05-19 | 9.4 Auto-First-Crosstab | — | Added `hasSeenAutoCrosstab` flag to `uiSlice`. `SlideContainer` auto-populates row + col variables from top 2 suggestions when example dataset loads, deck is empty, and flag is false. One-time toast: "We started your first analysis...". |
| 2026-05-19 | Phase 1: Smart Facets | — | Replaced passive dropdowns with actionable insight cards in `FacetedSearchBar.tsx` + `.module.css`. Type distribution mini-bar (5 clickable bars), Quality insight badge with incomplete/unlabeled counts + suggestions, Status insight with one-click "Unhide all" via `bulkHide`. |
| 2026-05-19 | Phase 2: Living Inspector | — | Cross-surface hover state: `hoveredVariableSetId` added to `uiSlice`. `VariableSetColumn` sets hover on mouse enter + highlights rows via `.itemHoverLinked`. `DraggableVariable` / `VirtualizedVariableList` / `DashboardShell` wire Canvas sidebar to mirror hover. Manager ↔ Canvas sidebar now highlight each other's variables. |
| 2026-05-19 | Phase 2: Recode Chronicle (minimal) | — | `GitBranch` lineage badge on derived variable sets in Manager list (`VariableSetColumn.tsx` + `MillerColumns.module.css`) and Canvas sidebar (`DraggableVariable.tsx`). Tooltip shows parent variable name resolved from `transformLog`. |
| 2026-05-19 | Tracker alignment | — | Added `STAB-UI-E` to tracker; quick wins + Phases 1–2 verified (typecheck clean, tests pass: `uiSlice.focusMode.test.ts`, `useSuggestedVariables.test.ts`, `SlideContainer.test.tsx`, `variableSetFilters.test.ts`, `DraggableVariable.test.tsx`). |
| 2026-05-21 | Phase 3: Library Layer | — | **Dataset Portraits:** `DatasetPortrait.tsx` + `workspaceLibrary.ts` — color signature bar, 7×3 activity heatmap, mini crosstab/bar/shelf thumbnail, session badge. **Project Timeline:** `WaveTimeline.tsx` delta preview on hover, ghost gap nodes, harmonization ring on project cards. **Ambient Search:** variable-name keyword matching, semantic hints, dynamic category chips (`Unanalyzed`, `With session`, etc.). Tests: `workspaceLibrary.test.ts` (8). |
| 2026-05-21 | Phase 4: Onboarding Layer | — | **Confidence Builder:** `uploadFeedback.ts` — stage headlines in upload overlay (`App.tsx`), CSV pre-load progress, format-specific toasts (Excel→CSV guidance, OPFS lock copy) via `useFileUpload.ts`; `PersistenceStatus` uses friendly OPFS headline. **Returning Researcher:** `returningResearcher.ts` + `WelcomeBackCard.tsx` — welcome card after 3+ days (`lastActiveAt` on dashboard entry, not workspace open); deck summary `title` on dataset cards; Manager change dot (`lastSeenTransformCount`, `ModeToggleButton`). Tests: `uploadFeedback.test.ts`, `returningResearcher.test.ts`. |

---

*End of vision document. Living artifact — iterate as back-room prototypes validate or invalidate the trust hypotheses above. Crosstab validation continues in `visual-polish-delight-validation-plan.md`.*
