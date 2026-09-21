# Design Reset Implementation Plan (Pathway B)

**Status:** Phases 1–3 implemented; Phase 4 incomplete. The July 4 evidence is a baseline, not final validation. Active closure is tracked in `tracker_00_implementation_status.md` §4.3.2.
**Date:** July 3, 2026 (status corrected July 14, 2026)
**Purpose:** Standalone execution plan for the approved design reset. A fresh session should be able to pick up any work package from this document alone, without the originating conversation.

---

## 0. Session bootstrap (read this first in a fresh session)

Read, in order:

1. [`docs/plan_04_design_reset_pathways.md`](plan_04_design_reset_pathways.md) — strategy, diagnosis, kill list, resolved decisions
2. [`docs/assets/design-reset-north-star/north_star.html`](assets/design-reset-north-star/north_star.html) — the visual target (interactive; open in a browser). Screenshot evidence: `ns-screen-{1,1-recipe,2,3,4}.png` in the same directory
3. [`AGENTS.md`](../AGENTS.md) — operating invariants (engine/core/UI boundaries, test expectations, PR contract)
4. [`docs/design_01_system.md`](design_01_system.md) + [`docs/design_02_ux_modes.md`](design_02_ux_modes.md) — current target contracts; use their convergence sections for known implementation gaps
5. [`docs/audit_07_pilot_presentation_readiness_2026-07-01.md`](audit_07_pilot_presentation_readiness_2026-07-01.md) — the tactical predecessor; explains what PR #18 already fixed
6. [`docs/deck_native_multi_agent_plan.md`](deck_native_multi_agent_plan.md) — product direction this reset serves (Report Job / deck recipe as durable object)

Decisions already made (do not re-litigate):

- **Pathway B**: deck-first IA inversion + visual reset, with the ⌘K palette as the universal insertion entry point
- **One theme**: evolved Soft Machine (tokens in §2). Mission Control and Liquid Glass are deleted, not deprecated
- **Dark mode deferred** until a pilot asks; must be the same identity when it comes
- **Accent budget**: accent appears only on the primary action, statistical significance, and the active drop target while dragging. Screens with no export/significance have zero accent
- **Success metric**: file-drop → three titled slides → PPTX in under 5 minutes, zero interruptions, at most one accent-colored element visible at a time

Working setup:

```bash
npm run dev            # Vite, local app
npm run typecheck      # gate: T
npm run lint           # gate: L
npm run test:run       # gate: U (vitest)
npm run test:e2e       # gate: I (Playwright)
npm run ci             # full local CI chain (includes check:design-tokens, eslint ratchet, build)
node scripts/ui-workflow-screenshot-audit.mjs   # workflow screenshot pack (gate: V evidence)
```

Test data: `test_data/sleep.sav` (E2E baseline), brand-tracker demo fixtures via `scripts/brand-tracker-demo.ts`.

Branch per work package (`design-reset/wp-1-1-single-theme`, …); commit after each significant batch; PR per phase using `.github/pull_request_template.md`.

---

## 1. Phase map

| Phase | Name | Outcome | Ships alone? |
| :--- | :--- | :--- | :--- |
| 0 | North star | 4 target screens + tokens (done — `docs/assets/design-reset-north-star/`) | Done |
| 1 | Subtraction | One theme, no coaching, quiet chrome; IA unchanged | Implemented |
| 2 | Inversion | Story rail, insert palette, recipe inspector, honest slide, two-pane VM | Implemented; correctness gaps remain in convergence |
| 3 | Density & craft | Typography-driven density, keyboard completion, motion/copy pass | Implemented; final quality audit remains |
| 4 | Evidence | Fresh final screenshots, truthful journey automation, representative sessions | **Open; closes the reset** |

Dependency rule: Phase 1 is a prerequisite for everything. Inside phases, work packages are ordered but separable — each leaves the app coherent.

---

## 2. Target token set (evolved Soft Machine)

Source of truth for values: the north-star mock. Production faces replace the mock's system stand-ins.

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
| `--color-accent` | `#B54E33` | Sienna — primary action + significance + live drop target ONLY |
| `--viz-fill-primary` | `#6F8177` | Sage — data marks (distributions, charts) |

Typography: **Fraunces** — slide titles inside the slide artifact only; **Plus Jakarta Sans** — all chrome; **JetBrains Mono** — data cells, variable names, tabular figures. The serif never appears on chrome (workspace, VM, toolbars, modals).

The semantic token API (`--bg-panel`, `--text-primary`, …) is unchanged — components keep consuming semantic tokens; only the mapping layer and theme machinery change.

---

## 3. Phase 1 — Subtraction

### WP1.1 — Single theme

**Scope:** collapse the theme system to one static token set.

Files:

- `src/theme/themes.ts` — replace three themes with one `velocity` theme carrying §2 values; delete `missionControl`, `liquidGlass`, the `materials` interface if now unused
- `src/context/ThemeContext.tsx` — simplify: no switching, no persistence of theme id; either inject the single theme statically or retire the context in favor of plain CSS custom properties in `src/index.css`
- `src/index.css` — delete all `[data-theme="mission-control"]` / `[data-theme="liquid-glass"]` blocks, radar-sweep and accent-bar hover animations, `.surface-panel` material fallbacks, and the Google Fonts imports for DM Sans / Newsreader / Atkinson Hyperlegible (keep Fraunces, Plus Jakarta Sans, JetBrains Mono)
- `src/components/common/ThemeSwitcher.tsx` + test — delete; remove from `DashboardToolbar` and `CommandPalette` commands (`commandPaletteSearch.ts`)
- `src/main.tsx` — remove theme bootstrapping as applicable

**Watch out:**

- **Exports are theme-aware.** `src/features/dashboard/hooks/useAnalysisExportAction.ts` (and the PPTX/XLSX exporters it feeds) read theme tokens for branding. Point them at the single theme; verify golden export tests (`tests/golden/`) and re-bless intentional diffs
- **localStorage migration:** stored theme ids (`mission-control`, `liquid-glass`) must fall back silently — no error, no toast
- `scripts/check-design-tokens.mjs` (CI gate) may assert theme-file structure — update the check alongside, in the same PR
- `CrosstabCell.tsx` reads theme context — confirm it only needs semantic tokens after the collapse

**Accept when:** one theme in the bundle; `npm run ci` green; PPTX export visually verified against a golden fixture; zero `data-theme` selectors left in `src/`.

### WP1.2 — Delete the coaching layer

**Scope:** remove all teaching UI; empty states become one line + one action.

Files:

- Delete `src/features/dashboard/onboarding/` (FirstCrosstabTour, ContextualMicroTipChip, contextualMicroTips, firstCrosstabTour + tests) and hooks `useFirstCrosstabTour.ts`, `useContextualMicroTips.ts`; strip usages from `DashboardShell.tsx`
- Empty canvas state (grep `Ready for Analysis` / suggested starting points): replace with the north-star screen-2 state — "Drag a variable here, or press ⌘K." + one ghost `Browse variables` button. No pills
- `src/components/common/ToastLayer.tsx` — replace stacked corner toasts with a single muted status-bar slot (one transient message at a time, bottom, auto-clearing); keep the API so callers don't change, or thin it and update callers
- Keep `KeyboardShortcuts.tsx` overlay as the single `?` reference surface
- Review `DesktopRecommendationBanner.tsx`, `PilotEnvironmentBanner.tsx`, `StorageStatusIndicator.tsx` against the anxious-copy rule: one-line, muted, footer-positioned, or deleted

**Accept when:** a full upload → crosstab → export → reopen workflow shows zero popovers/toasts over any artifact; E2E asserts no coaching on resume still passes (it exists from PR #18 — repurpose, don't delete).

### WP1.3 — Quiet toolbar

**Scope:** `DashboardToolbar.tsx` to three visible controls + overflow.

- Visible: view toggle (table/chart), `Insert ⌘K` ghost (Phase 2 wires it; in Phase 1 it opens the existing CommandPalette), primary `Export`
- Overflow `···` menu: Import Session, Export Session, Reset, anything else surviving
- Delete top-level: theme switcher (gone in WP1.1), density control, Variables badge (VM entry moves to overflow until Phase 2 relocates it)
- Ghost button styling per north star: transparent default, `--bg-rail` hover, no borders

**Accept when:** toolbar renders ≤ 4 interactive elements; Export is the only accent element on the canvas screen.

### WP1.4 — Accent budget enforcement

**Scope:** repo-wide accent audit.

- Neutral focus rings everywhere (`--border-color-active` maps to ink, not accent)
- Drop zones: accent border only while a drag is in progress; neutral dashed otherwise
- `VariableTypeIcon.tsx`: monochrome glyphs (ink-3 on hairline-bordered box, per north star); delete the 5-color tag token mappings (`--tag-*`) or map them all to neutral
- Significance arrows/letters keep accent; verify `SignificanceLegend.tsx` copy still matches
- Grep `--color-accent` and `--text-accent` consumers; every remaining use must be one of: primary action, significance, live drop target

**Accept when:** grep audit documented in the PR (file list with justification per remaining accent use); screenshot pass shows ≤ 1 accent element per screen (excluding in-table significance marks).

---

## 4. Phase 2 — Inversion

Re-read `docs/design_02_ux_modes.md` §2 and the deck-native charter before starting: the Canvas remains the hub; these packages change what is *resident* vs *summoned*.

### WP2.1 — Story rail

**Scope:** left rail becomes the deck outline.

- `DashboardShell.tsx` + `DashboardSidebar.tsx`: replace the resident variable list with the slide outline (deck name, numbered slide rows with title + recipe summary line, `+ New slide`, muted persistence footer)
- Retire `TimelineDock.tsx` (+ test) — the rail *is* the timeline. Slide reordering moves to the rail (drag or ⌘↑/⌘↓)
- Slide state source of truth: existing deck slice in `src/store` — no new state shape; the rail is a new view of the deck
- The variable list component (`VirtualizedVariableList`, `DraggableVariable`) is not deleted — it relocates into the palette/browser in WP2.2

**Accept when:** deck navigation, selection, rename, reorder, delete work from the rail; E2E slide-flow specs re-recorded; no residual dock.

### WP2.2 — Insert palette

**Scope:** variables are summoned, not resident.

- Evolve `CommandPalette.tsx` + `commandPaletteSearch.ts` into the insert palette per north-star screen 3: search-first, dense rows (mono variable name, label, type glyph, meta), insertion grammar **↵ → columns, ⌥↵ → rows, ⇧↵ → filter** (`DESIGN-CONV-K1`; north-star mock originally flipped Enter/⌥Enter — product code wins), esc closes
- `Insert ⌘K` toolbar button and empty-state `Browse variables` both open it
- Drag out of the palette onto the slide still works (reuse `useDashboardDnD`)
- Command actions (export, VM, etc.) remain available behind a `>` prefix or a commands tab — variables are the default result set

**Accept when:** a crosstab can be built keyboard-only from an empty slide (⌘K, type, ↵, ⌘K, type, ⌥↵); unit tests cover the insertion grammar; palette opens in <100ms on the 500-variable fixture.

### WP2.3 — Recipe inspector

**Scope:** analysis configuration becomes slide properties.

- Replace the persistent `AnalysisShelf.tsx` + `FilterBar.tsx` row with a right-side collapsible inspector (north-star screen 1-recipe): Rows / Columns / Filter / Weight chips, display settings (Cell n, Bases — from `AnalysisSettingsPanel.tsx`), significance method line
- Collapsed by default; `Recipe` ghost button toggles; state per session
- Chips are droppable targets (drag from palette) and removable; empty slots render dashed-neutral
- This is the visible face of deck-recipe state (deck-native Gate 3) — bind to existing recipe/session structures, do not invent a parallel one

**Accept when:** all shelf capabilities (add/remove/swap rows, columns, filter, weight) exist in the inspector; shelf and FilterBar components deleted; session round-trip tests still green.

### WP2.4 — Honest slide

**Scope:** the canvas renders what exports.

- `SlideContainer.tsx` / `AnalysisOutputFrame.tsx`: stats footer (`StatisticsStatusBar`) moves outside the slide card as a margin note (muted, one line); slide card contains only exportable content
- Verify shrink-wrap behavior (UXF-004, shipped) still holds with the margin note outside
- Slide title/subtitle typography per §2 (serif title inside artifact only)
- Add a parity check to the report-quality harness (`scripts/report-quality/`): canvas slide screenshot vs exported PPTX slide for the golden fixture — differences must be enumerable (fonts aside)

**Accept when:** margin note never appears in PPTX; visual parity evidence attached to PR.

### WP2.5 — Two-pane Variable Manager

**Scope:** compress five panes to two.

- Delete `DataSourceColumn.tsx`, `FolderColumn.tsx`, `FolderPanel.tsx`, `VariableSetColumn.tsx`, `MillerColumns.module.css` (+ tests)
- `VariableManager.tsx`: search field + filter chips (type counts; sets and sources become chip filters via `variableSetFilters.ts`) + dense 32px rows (glyph · mono name · label · one contextual metadata column) + `VariableInspector` (keep; restyle per north-star screen 4)
- `FacetedSearchBar` folds into the single search+chips row; `BulkActionBar` appears only on multi-select; `Sparkline` usage retreats to the inspector distribution
- Delete the VM stats header

**Accept when:** every VM job-to-be-done (find, inspect, recode entry, set management, bulk ops) is reachable in the two-pane layout; VM E2E re-recorded; row density ≥ 20 variables visible at 900px height.

---

## 5. Phase 3 — Density & craft

- **WP3.1 Keyboard completion:** slide nav (↑/↓ or J/K in rail), rename (Enter), palette everywhere, `?` overlay updated. Acceptance: the 5-minute metric achievable mouse-free after file drop
- **WP3.2 Motion pass:** one standard transition (150ms ease); remove decorative framer-motion animations (audit `src/lib/motion.ts` consumers); respect `prefers-reduced-motion`. Acceptance: no animation longer than 200ms; no entrance animations on data
- **WP3.3 Copy pass:** every empty state, error, and label against the writing rules (active voice, one job per element, no anxious copy); pluralization; sentence case on chrome. Acceptance: copy inventory table in PR
- **WP3.4 Type & spacing sweep:** 13px UI base, 11px caps labels with letter-spacing, tabular-nums on all numeric columns, hairline discipline. Acceptance: side-by-side with north-star screens — an outside reviewer cannot tell mock from app at a glance

---

## 6. Phase 4 — Evidence & reconciliation

Phase 4 was previously marked complete when the baseline pack and timed automation landed. That classification was too broad. The pack predates the approved convergence work, the documented palette grammar differs from current command behavior, the automation records elapsed time without asserting the intended rows/columns recipe, the normal overflow interaction currently requires a forced click in screenshot tooling, and no representative sessions have run. Phase 4 closes only after the tracker’s `DESIGN-CONV-A` gate passes.

- **WP4.1** Re-run `node scripts/ui-workflow-screenshot-audit.mjs`; commit the new pack under `docs/assets/design-reset-evidence/`; before/after against both the July 1 audit pack (`ui-pilot-readiness-audit/screenshots-p2-final/`) and the north-star screens
- **WP4.2** Timed pilot-demo pass: file-drop → three titled slides → PPTX. Record time and interruption count. Pass: < 5 minutes, zero interruptions. Methodology below.
- **WP4.3** Update docs in the same PR: rewrite `design_01_system.md` (single theme, token table from §2), amend `design_02_ux_modes.md` (rail/palette/inspector responsibilities), close this plan's rows, reconcile `tracker_00_implementation_status.md`
- **WP4.4** PILOT-6 photography used post–PR #18 UI (July 2 `screenshots-p2-final/`). **Re-screenshot required** before paid pilot recruiting — chrome contracts changed materially (story rail, palette-only variables, recipe inspector, single theme). Flag raised; photography not yet re-run on post-reset UI.

### WP4.2 — Five-minute metric pass methodology

**Goal:** Verify the automated journey and validate the final experience under representative pilot conditions.

**Environment:** Local `npm run dev`, Chromium 1440×900, `test_data/sleep.sav` (or a pilot's own SAV of similar size). One operator, no mouse unless unavoidable. Stopwatch from first file drop to PPTX saved.

**Procedure (timed steps):**

| Step | Action | Keyboard path |
| :--- | :--- | :--- |
| 1 | Drop `sleep.sav` on workspace landing (or Upload → select file) | — |
| 2 | Load Full Data if metadata interstitial appears | Enter |
| 3 | Slide 1: ⌘K → `sex` → ⌥↵ (rows); ⌘K → `marital` → ↵ (columns) | palette grammar (`DESIGN-CONV-K1`) |
| 4 | Edit slide title to a stakeholder label (e.g. "Gender by marital status") | click title or rail rename |
| 5 | `+ New slide` in story rail → repeat palette for slide 2 (e.g. `age` × `region`) | ⌘K grammar |
| 6 | `+ New slide` → slide 3 (e.g. single-variable distribution) | ⌘K → ↵ |
| 7 | Export → PPTX → confirm download | toolbar Export |

**Record:** total elapsed time, resulting row/column recipe on every slide, interruption count (popover, toast, modal unrelated to export, coaching overlay), forced interactions, accent violations (more than one accent chrome element visible outside significance marks), and export-preview completion.

**Automated pass:** < 5:00 elapsed, correct saved recipe on every slide, zero interruptions, zero forced interactions, review-before-download completed, and ≤ 1 accent chrome element per screen.

**Validation pass:** 3–5 people from the target workflow complete the final candidate without coaching; record discovery, errors, recovery, and confidence separately from automated timing.

**Evidence:** Timed run notes in PR body; screenshot pack (`docs/assets/design-reset-evidence/`) for visual before/after; E2E theme baseline (`visual-polish-theme-table.spec.ts`) re-recorded for single identity.

---

## 7. Cross-cutting rules (every work package)

1. **Gates per PR:** typecheck (T), lint (L), unit (U), E2E/visual (I), screenshot evidence (V). `npm run ci` must pass locally before PR
2. **Deletions are real:** removed components leave no dead exports, orphaned tests, unused tokens, or `TODO: restore`. Coverage config (`vitest.config.ts` excludes) may need pruning when files disappear
3. **Foundation scope:** phases 1–3 did not change engine computation. Active convergence may change persisted UI/store orchestration to restore each slide's weight and analysis settings; follow the engine/session and dual-state playbooks if that work crosses their boundaries.
4. **E2E churn is expected:** re-record baselines intentionally per package, never blanket-update snapshots to green a build
5. **Session compatibility:** `.velocity` session import must keep working across every package (deck state, analysisSettings). Add a round-trip test to any PR touching persisted shapes
6. **MCP/agent surface untouched** except where UI state names leak into session exports — verify with `mcp:build` tests
7. **Update this doc** (status column below) and the tracker in the same PR when a package lands

---

## 8. Status board

Phases 1–3 landed. Phase 4 rows below distinguish baseline evidence from final closure.

| WP | Name | Status | Commit / evidence |
| :--- | :--- | :--- | :--- |
| 0 | North star screens | **Done** | `b41c546` (main); `docs/assets/design-reset-north-star/` |
| 1.1 | Single theme | **Done** | `bc3bee5` — static tokens in `index.css`; ThemeContext/ThemeSwitcher deleted |
| 1.2 | Delete coaching layer | **Done** | `a3a230c` — onboarding deleted; one-line empty state; single status slot |
| 1.3 | Quiet toolbar | **Done** | `978fb4b` — view toggle, Insert ⌘K, overflow, primary Export |
| 1.4 | Accent budget | **Done** | `45d8cfa`, `0bfc383` — grep audit; ink focus rings; monochrome type glyphs |
| 2.1 | Story rail | **Done** | `8d8807b` — `StoryRail` wired; TimelineDock retired |
| 2.2 | Insert palette | **Done** | `22e6511` — ↵/⌥↵/⇧↵ grammar; variables default; `>` commands; WP2.2 open budget verified (`wp22-palette-open-benchmark.json`, median 15ms on 500-var fixture) |
| 2.3 | Recipe inspector | **Done** | `8d8807b` — shelf/FilterBar retired; chips + display settings |
| 2.4 | Honest slide | **Done** | `99e104f`, `d1ba222` — margin note outside card; not in PPTX; structural parity via `canvas-pptx-parity.mjs` (`wp24-canvas-pptx-parity.json`) |
| 2.5 | Two-pane Variable Manager | **Done** | `c8bf902`, `a655c0d` — Miller columns deleted; dense rows + inspector |
| 3.1 | Keyboard completion | **Done** | `da434a5` — rail J/K, rename ↵, palette everywhere, `?` overlay |
| 3.2 | Motion pass | **Done** | `da434a5` — 150ms standard; decorative motion removed |
| 3.3 | Copy pass | **Done** | `da434a5` — empty states, errors, labels per writing rules |
| 3.4 | Type & spacing sweep | **Done** | `da434a5` — 13px UI base, hairline discipline, tabular-nums |
| 4.1 | Screenshot audit | **Baseline only** | `docs/assets/design-reset-evidence/screenshots/` (15 frames, July 3 2026); recapture after convergence |
| 4.2 | Five-minute metric | **Automated baseline only** | Script recorded **0:11**, but does not yet prove the documented recipe grammar or normal pointer behavior; correct and rerun under `DESIGN-CONV-K1/K3` |
| 4.3 | Docs reconciliation | **Done** | Core status documents corrected July 14; tracker §4.3.2 owns active closure |
| 4.4 | Final photography and sessions | **Blocked** | Starts after convergence blockers land; requires fresh screenshots and 3–5 unscripted representative sessions (`DESIGN-CONV-A`) |

**Foundation evidence head:** `5c85707`. Do not interpret this commit as final redesign validation.

---

## 9. Risks

| Risk | Mitigation |
| :--- | :--- |
| PPTX export regression from theme collapse (WP1.1) | Golden export fixtures verified before/after; export theming is an explicit checklist item, not incidental |
| E2E baseline churn overwhelms review | One package per PR; re-record only specs the package touches; name re-recorded specs in the PR body |
| Palette-only insertion hurts discoverability for drag-first users (WP2.2) | Drag from palette and from VM remains; empty state names both paths; watch first pilot session recordings |
| Recipe inspector duplicates deck-recipe state (WP2.3) | Bind to existing store/session structures; session round-trip test is the gate |
| Removing the resident variable list slows expert scanning (WP2.1/2.2) | Palette must handle the 500-variable fixture <100ms; VM is one keystroke away; revisit only with pilot evidence |
| Coverage/CI gates break on mass deletion | Run `npm run ci` per package; prune vitest excludes and the design-token check in the same PR as the deletion |

## 10. Non-goals

No dark mode. No new themes or theme infrastructure. No engine, statistics, or MCP capability changes. No new analysis features. No workspace redesign beyond what audit_07 already shipped (revisit after Phase 4). No accessibility-theme work (UXF-016 stays deferred behind `STAB-UI-F5`).
