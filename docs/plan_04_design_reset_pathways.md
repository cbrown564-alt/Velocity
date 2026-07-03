# Design Reset: Pathways to a Calm, Story-First Velocity

**Status:** Pathway B approved (July 3, 2026) — evolved Soft Machine identity, dark mode deferred. Phase 0 (north-star screens) in progress; see `docs/assets/design-reset-north-star/north_star.html`
**Date:** July 3, 2026
**Quality bar:** Linear-grade restraint, applied structurally this time — not as a fix list
**Companion docs:** [`audit_07_pilot_presentation_readiness_2026-07-01.md`](audit_07_pilot_presentation_readiness_2026-07-01.md) (tactical predecessor), [`deck_native_multi_agent_plan.md`](deck_native_multi_agent_plan.md) (product direction), [`design_01_system.md`](design_01_system.md) (to be superseded), [`design_02_ux_modes.md`](design_02_ux_modes.md)

---

## 1. Why audit_07 wasn't enough

The July 1 audit fixed *instances* of clutter (popovers on the hero, dead space, truncation) but preserved the *systems* that generate clutter. The app still reads as over-built because the generators are intact:

| Clutter generator | Evidence | Cost |
| :--- | :--- | :--- |
| **Three-theme system** | `src/theme/themes.ts` (Soft Machine, Mission Control, Liquid Glass), dynamic token injection, materials/blur system, per-theme hover animations (radar sweep, coral bar) | Every component designed and tested ×3; no single opinionated identity; accent budget impossible to enforce across three palettes |
| **Coaching subsystem** | `FirstCrosstabTour`, `contextualMicroTips`, suggestion pills, toast stack ("Focus mode", "Brand tracker example loaded"), empty-state "Suggested starting points" | Multiple teaching layers still compete with the artifact; the July 3 screenshots show two toasts stacked on the canvas |
| **Toolbar sprawl** | `DashboardToolbar`: table/chart toggle, Import Session, Export Session, Export, theme switcher, density, Variables badge, Reset, expand | 9 persistent top-level controls; most used less than once per session |
| **Big-button variable list** | `DashboardSidebar` / `VirtualizedVariableList`: 44px+ rounded buttons, colored type icons, per-row `+` buttons | ~14 variables visible per screen; a 500-variable tracker becomes a scrolling wall of buttons |
| **Five-pane Variable Manager** | Sources / Folders / Variable Sets / Variables / Inspector + stats header + three filter dropdowns | Miller columns spend width on navigation that search already does better; header stats duplicate filter chips |
| **Detail maximalism** | Sparklines, top-category chips, percentages, quality dots on every VM row | "Every bit of space shows some detail" — nothing is prioritized, so nothing is scannable |

**Diagnosis:** Velocity has accumulated three personalities — analytics IDE, guided onboarding product, and deck builder. The redesign must pick one (deck builder, per the deck-native charter) and make the other two subordinate or invisible.

---

## 2. Research: what the best tools in adjacent spaces do

### Linear (the stated bar)

- **Opinionated software.** "You should design something for someone; it's really hard to design something really good for everyone." Linear ships one way of working, few settings, no themes beyond light/dark of a single identity. Productivity tools should have a point of view instead of being a flexible sandbox ([Figma blog](https://www.figma.com/blog/the-linear-method-opinionated-software/), [First Round Review](https://review.firstround.com/podcast/inside-linear-why-craft-and-focus-still-win-in-product-building/)).
- **Craft as the moat.** Quality-at-detail is Linear's differentiation strategy in a crowded market, not a nice-to-have ([Lenny's Newsletter interview](https://www.lennysnewsletter.com/p/inside-linear-building-with-taste)).
- **Calm despite density.** Linear is data-dense (issue lists) but reads calm because: one accent used only for meaning, typography does hierarchy (not boxes), rows are text-first at ~32px, buttons are ghost-quiet, and the command palette absorbs the long tail of actions so chrome doesn't have to.

### Calm technology / calm UX

- **Earn the right to interrupt.** Default to silent; batch or eliminate notifications; never interrupt over the artifact the user is producing ([Calm Tech Institute](https://www.calmtech.institute/calm-tech-principles), [UXmatters](https://www.uxmatters.com/mt/archives/2025/05/designing-calm-ux-principles-for-reducing-users-anxiety.php)).
- **Progressive disclosure over coaching.** Reveal complexity when engaged, not preemptively. A well-designed empty state is one line + one action — the interface teaches by being obvious, not by talking.
- **Forgiveness over confirmation.** Undo everywhere beats warning popovers; glanceable status chips beat toasts.

### The competitive field

- **Displayr/Q** sell power and "everything on one screen" — which produces exactly the enterprise density Velocity should refuse ([Displayr's own positioning](https://www.displayr.com/displayr-and-q/)). Their UI is ribbon-era; nobody in MR tooling currently looks or feels like Linear.
- **AI-native entrants** (Displayr Research Agent, Yabble, quantilope) are all converging on "AI does the analysis for you" — magic-button positioning that trades away trust and inspectability.
- **The user's real pain** is not running crosstabs; it's the 4+ hours of slide formatting after the analysis is done, and the fact that automation handles templated updates but not *discovering and crafting the story* ([AI for Insights Leaders](https://aiforinsightsleaders.substack.com/p/how-to-create-a-market-research-presentation), [Displayr resources](https://displayr.com/resources/powerpoint)).

### Differentiation thesis

Boutique researchers are judged on the visual craft of their deliverables. A tool that itself embodies restraint and craft is a credibility signal no incumbent sends:

> **Displayr is the enterprise IDE. Velocity is the craftsman's bench.**
> Local, instant, quiet. The tool disappears; the story remains.

This also differentiates against the AI wave: Velocity's bounded-agent posture (approval adjacent to every action, provenance on every number) pairs naturally with a calm interface — *trustworthy* is the aesthetic, in both statistics and pixels.

---

## 3. The core user's task, friction-audited

Sarah the Strategist, Friday 4 PM: `.sav` in hand, client wants three slides by five.

| Step | Today | Target |
| :--- | :--- | :--- |
| Open file | Workshop Door → upload → canvas | Same (already good) — drop file anywhere, land on first slide |
| Find variables | Scroll a wall of buttons, or ⌘K (hinted in 3 places) | One search field that is *the* way in; list rows dense enough to scan 30+ at once |
| Build crosstab | Drag to shelf zones with coral outlines + hint popover + suggestion pills | Drag still works, but ⌘K "Q5 by segment" builds the slide; shelf is quiet properties of the slide, not standing chrome |
| Read significance | Arrows + stat footer + toggles (Cell n, Bases) + insight chip | Same stats, zero coaching; footer is one muted line; toggles live in one slide-settings popover |
| Make it a story | Rename slide, add another; timeline dock at bottom | Slide outline is the left rail (filmstrip): the deck's narrative is the primary navigation, reordering is direct |
| Export | Toolbar Export → modal | One primary button in the top right — the only accent-colored control on the screen |

**Success metric:** file-drop → three titled slides → PPTX in under 5 minutes, with zero interruptions and at most one accent-colored element visible at any time.

---

## 4. Pathways

### Pathway A — Visual reset (conservative)

Keep the current IA (variable sidebar / shelf / canvas / timeline dock; VM overlay). Execute a strict token-and-component pass:

- One theme; delete two; delete materials/blur, per-theme animations, theme switcher; ThemeContext becomes static tokens.
- Accent budget: accent = significance + primary action + active selection, nothing else. All other chrome neutral.
- Density pass: variable rows to ~32px text rows; toolbar collapsed to 3 visible controls + overflow.
- Delete coaching subsystem; empty states become one line + one action.

**Effort:** ~2–4 weeks. **Risk:** Low. **Ceiling:** Medium — the app gets quieter but keeps its "analytics workbench with slides attached" posture. Doesn't move the deck-native charter forward.

### Pathway B — Deck-first inversion + visual reset (recommended)

Everything in A, plus invert the information architecture around the deck, aligning the UI with the deck-native charter (`Report Job` as the durable object):

- **Left rail = the story.** Slide outline/filmstrip replaces the persistent variable list. The deck's narrative structure is the primary navigation — like Pitch/Keynote, not like SPSS.
- **Variables become a summonable palette.** ⌘K and a quiet "Insert" affordance open the variable browser as an overlay/panel on demand; it is not standing chrome. (The variable list is an *ingredient drawer*, not a wall.)
- **Analysis config becomes slide properties.** Rows/columns/filter/weight live in a right-side inspector for the selected slide (collapsed by default), not a persistent shelf above the canvas. A slide *is* its recipe — which also makes recipe persistence (Gate 3) visible product truth instead of hidden machinery.
- **The canvas is the slide, honestly rendered.** What you see is what exports. Stat footers and working annotations render as canvas margin notes, visually outside the artifact.
- **Variable Manager compresses to two panes.** Searchable dense list + inspector (sets/folders become filters, not columns). It remains the high-density spoke, but density comes from typography, not from five panels.

**Effort:** ~6–10 weeks in phases (see §6). **Risk:** Medium — IA change needs E2E/screenshot re-baselining. **Ceiling:** High — this is the "radical overhaul" that makes story-building front and centre, and it directly serves PILOT-3 (recipes, review-before-export) rather than competing with it.

### Pathway C — Keyboard-native minimalism (radical)

Superhuman/Raycast posture: the screen is the slide plus a command line; *all* configuration happens through the palette and transient panels; near-zero persistent chrome.

**Effort:** ~8–12 weeks. **Risk:** High — Sarah is not a keyboard-first power user; discoverability collapses for exactly the boutique/consultant ICP; demos poorly to pilot participants who screenshot the UI expecting to see *some* affordances. **Verdict:** Take its best organ (palette as the universal entry point) and transplant it into B; don't adopt the body.

### Anti-pathway D — "Build mode vs Present mode" split

Splitting a dense workbench surface from a clean presentation surface would recreate mode sprawl and admit the workbench can't be calm. Focus mode already demonstrated the failure: hiding chrome one layer at a time never ends. Rejected.

---

## 5. The kill list (applies under every pathway)

Deletions, not redesigns. Each row is code removed and a decision permanently made:

| # | Delete | Replace with |
| :--- | :--- | :--- |
| 1 | Mission Control + Liquid Glass themes, materials system, per-theme hover animations, theme switcher | One theme (evolved Soft Machine: quieter neutrals, ink text, restrained accent; serif reserved for the slide artifact only). Dark variant *of the same identity* later, only if pilots ask |
| 2 | `FirstCrosstabTour`, `contextualMicroTips`, suggestion pills, onboarding toasts | Obvious-by-design empty states (one line + one action); a single `?` shortcut overlay for keyboard reference |
| 3 | Toast notification pattern | One status-bar slot (bottom, muted) for transient confirmations; undo instead of warnings |
| 4 | Toolbar: theme switcher, density control, Reset, Variables badge, Import/Export Session as top-level buttons | 3 visible controls (view toggle, share/export primary, overflow `…` menu holding session ops and reset) |
| 5 | VM stats header ("13 Category, 4 Scale…"), Sources + Folders columns | Filter chips inside search; two-pane VM (list + inspector) |
| 6 | Per-row sparklines/top-category chips/quality percentages shown simultaneously | One metadata column, chosen by what the row is answering; the rest in the inspector |
| 7 | Colored type-tag system (5 tag colors) | Monochrome type glyphs; color reserved for meaning (significance, warnings) |
| 8 | Coral focus rings, coral drop-zone borders, coral empty-state icons | Neutral rings/borders; accent only on the drop target *while dragging* |

Estimated net effect: thousands of lines deleted, design surface ×3 → ×1, and `design_01_system.md` §3/§8/§11–12 (themes, theme interactions, theme rationale, future themes) retired.

---

## 6. Execution phases (Pathway B)

Phased so every stage ships a coherent, screenshot-ready app — reusing `scripts/ui-workflow-screenshot-audit.mjs` as the evidence loop, consistent with the deck-native turn protocol.

1. **Phase 0 — North star.** Design 4 static screens (canvas with crosstab slide, empty first-run, variable palette open, VM) as the target. Evaluate against the §3 metric before any code.
2. **Phase 1 — Subtraction.** Execute the kill list. One theme, no coaching, quiet toolbar. (This is Pathway A; it is a prerequisite for B and is worth shipping alone.)
3. **Phase 2 — Inversion.** Slide outline to left rail; variables to summonable palette; shelf to slide-properties inspector; timeline dock retired.
4. **Phase 3 — Density & craft.** Variable list/VM typography-driven density; keyboard path completion; motion pass (one standard transition, no signature animations).
5. **Phase 4 — Evidence.** Re-run the workflow screenshot audit; pilot-demo pass against the 5-minute metric; update `design_01`/`design_02` to describe the new system.

Gates per phase: typecheck, lint, unit, E2E/visual re-baseline, screenshot pack in `docs/assets/`.

---

## 7. Decisions (resolved July 3, 2026)

1. **Pathway choice** — **B approved** (deck-first inversion + visual reset, with C's palette-first insertion as the universal entry point).
2. **Surviving theme identity** — **evolved Soft Machine**: warm neutrals, green-ink text, one sienna accent under a strict budget, serif reserved for the slide artifact only.
3. **Timing vs. PILOT-6** — open; revisit after Phase 0 north-star review.
4. **Dark mode** — **deferred** until a pilot asks; must be the same identity, not a second personality.
