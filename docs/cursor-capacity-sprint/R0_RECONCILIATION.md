# DESIGN-CONV-R0 — Candidate reconciliation

**Status:** complete (reconciliation only; candidates not promoted to Done)  
**Date:** 29 July 2026  
**Baseline `main`:** `3ba59646668046140460c6d36a8768b701407083` (includes merged Cursor capacity sprint plan, PR #63)  
**Canonical status owner:** `docs/tracker_00_implementation_status.md`  
**Execution plan:** `docs/cursor-capacity-sprint/PLAN.md`

## V0.1 Protected baseline

| Item | Record |
| :--- | :--- |
| Starting SHA | `3ba59646668046140460c6d36a8768b701407083` |
| Required local gates | `npm run ci` (lint, eslint ratchet, e2e companion, format, typecheck:all, worker/querybuilder/design-token guards, unit coverage, parity, build, chunk budgets) |
| Browser journeys | `npm run ci:full` → `npm run ci` + `npm run ci:e2e`; visual: Playwright `@visual`; journey script: `scripts/design-reset-five-minute-pass.mjs` |
| Branch protection API | Not readable with this integration token (HTTP 403). Treat required checks as those green on PR #63: `lint-format`, `typecheck`, `arch-guards`, `mutation`, `unit-coverage`, `e2e`, `build`, `journey-gate`, `visual-e2e`, Vercel. |
| Five-minute journey on baseline | Reset foundation present; Phase 4 / DESIGN-CONV gaps remain (see tracker §4.3.1–4.3.2). |
| Known baseline product gaps | No `ExportPreviewLane`; focus mode still shipped; no recent/pinned strip; no palette onboarding ghost; story rail not collapsible; no canvas handoff helper; no persistent import rail summary; K1/K2/K3 not started. Main `ExportModal` already has `buildExportReview` readiness gating, but not the required thumbnail/recipe preview lane. |
| Backend-reset / engine-boot | Audit 10 closed 15 July 2026 — do not reopen without contrary evidence. |

## V0.2 Candidate inventory

Primary refs are the open PR heads. Legacy `*-1e13` tips are noted only when they merge cleaner or are superseded by a newer PR branch.

| ID | PR | Primary ref | Tip | Ahead / behind `main` | Intended retained behaviour |
| :--- | :--- | :--- | :--- | :--- | :--- |
| B | #55 | `cursor/design-conv-b-export-preview` | `74338bb` | 3 / 15 | Required export preview lane: slide thumbnails, recipe/weight/filter/view summary, significance audit, then PPTX download; E2E cannot bypass review. |
| C | #54 | `cursor/design-conv-c-recent-strip-1e13` | `9007965` | 2 / 15 | Thin recent-and-pinned variable strip; persisted UI prefs; not a full sidebar. |
| D | #52 | `cursor/design-conv-d-palette-onboarding` | `03674a2` | 2 / 15 | One-time insert-palette ghost teaching row/column grammar; dismiss forever. |
| E | #57 | `cursor/design-conv-e-deck-templates-1e13` | `3aed573` | 2 / 15 | Splash/workspace “start from template” → three-slide brand-tracker skeleton. |
| F | #51 | `cursor/design-conv-f-nl-palette-1e13` | `2417805` | 1 / 15 | Natural-language crosstab binding in the insert palette. |
| G | #49 | `design-conv-g-collapsible-rail` | `6f2eb38` | 2 / 15 | Story rail collapses for small decks and expands predictably (keyboard + tests). |
| H | #58 | `cursor/design-conv-h-canvas-handoff-1e13` | `442110d` | 2 / 15 | After upload, land on slide 1 with insertion path ready; journey metrics for handoff. |
| I | #56 | `cursor/design-conv-i-recipe-diff-1e13` | `e63f40e` | 2 / 15 | Quiet imported-session summary on the story rail (slides, unresolved vars, recipe changes). |
| Q5 | #50 | `cursor/design-conv-q5-retire-focus` | `055f998` | 2 / 15 | Remove focus mode control, shortcut, chrome rules, and obsolete tests. |
| A | #59 | `cursor/design-conv-a-pilot-evidence` | `4c8ea7f` | 2 / 15 | Evidence kit / scorecards / session templates — not product behaviour. |
| Q6 | #53 | `cursor/design-conv-q6-recipe-audit` | (open docs PR) | — | Audit already Done on `main` (`docs/design_reset_recipe_legibility_audit.md`). |

### Absent on current `main` (code probe)

Confirmed missing: `ExportPreviewLane`, `exportPreviewSummary`, recent/pinned strip, palette onboarding, story-rail collapse, canvas handoff modules, session import rail summary UI, deck-template entry. Focus mode symbols remain live in `uiSlice`, `AppShell`, `DashboardToolbar`, and related tests.

## Conflict matrix (merge `--no-commit` against baseline)

| ID | Full merge | Conflict class | Conflict paths |
| :--- | :--- | :--- | :--- |
| B | Conflict | Docs only | `docs/design_02_ux_modes.md`, `docs/tracker_00_implementation_status.md` |
| C | Conflict | Docs only | `docs/tracker_00_implementation_status.md` |
| D | Conflict | Docs only | `docs/tracker_00_implementation_status.md` |
| E | Conflict | Code + docs | `useSessionLifecycle.ts`, `SplashScreen.tsx`, tracker |
| F | Conflict | Docs only | tracker |
| G | Conflict | Docs only | `docs/design_02_ux_modes.md`, tracker |
| H | Conflict | Code + docs | `scripts/design-reset-five-minute-pass.mjs`, tracker |
| I | Conflict | Code + docs | `src/App.tsx`, `AppModeRouter.tsx`, tracker (`useSessionLifecycle.ts` merges clean) |
| Q5 | Conflict | Docs only | `docs/design_02_ux_modes.md`, tracker |
| A | Conflict | Docs only | `docs/pilot_06_paid_pilot_program.md`, tracker |
| B legacy `*-1e13` | Clean | — | Historical tip; superseded by #55 for integration |
| D legacy / Q5 legacy / G `*-1e13` | Clean | — | Prefer PR heads; use legacy only as behaviour reference |

Most “nine of ten conflict” noise is tracker/status doc drift from candidates marking themselves In review. That must not be merged as Done.

## Dispositions

| ID | Disposition | Integration method | Notes |
| :--- | :--- | :--- | :--- |
| B | **Retain** | Partial transplant | Take preview-lane code/tests from #55; rewrite doc/tracker edits in the landing PR. Main already has readiness lists via `buildExportReview` — B still required for thumbnail/recipe lane and bypass-proof E2E. |
| C | **Retain** | Clean code merge / transplant | Docs-only conflict. Keep status Candidate until DESIGN-CONV-A shows discovery value. |
| D | **Retain** | Clean code merge after K1 | Must teach the **final** K1 grammar; do not land before K1. |
| E | **Defer (later)** | Reimplement on current `main` when unblocked | Non-blocking; sprint forbids templates before core journey. Code conflicts in session/splash lifecycle. |
| F | **Reject for this sprint** | Do not merge | Explicit non-goal (NL palette) until after DESIGN-CONV-A demand. |
| G | **Retain** | Partial transplant | Docs-only conflict on PR head. Sequence before I (shared `StoryRail`). |
| H | **Retain** | Partial transplant | Rework five-minute script against current main; assert analysis state, not only timing. Depends on K1 for grammar assertions. |
| I | **Retain** | Partial transplant | Manual prop wiring in `App` / `AppModeRouter`. Replaces toast-only diagnostics with rail summary — preserve diagnostic data in the summary builder. Depends on K2. |
| Q5 | **Retain** | Partial transplant | Docs-only conflict. Wave 1 chrome removal; land before Wave 2 items that touch `CommandPalette` / `DashboardShell` / `uiSlice`. |
| A | **Retain as prep only** | Re-run on final `main` | Do not promote intermediate photography or scorecards as gate pass. |
| Q6 | **Already Done** | No code integration | Stale PR #53 is documentation echo; remediation remains K2 + I. |
| K1 / K2 / K3 | **New work** | Implement on current `main` | No candidate branches. Highest correctness value after R0. |

No candidate is silently promoted to Done.

## Ordered integration sequence

```text
main @ 3ba5964  (R0 evidence merged)
└── Wave 1 (pilot blockers) — prefer this safer serial order when capacity is scarce:
    1. DESIGN-CONV-Q5   (remove focus mode; shrink shared UI surface)
    2. DESIGN-CONV-K1   (canonical palette grammar)
    3. DESIGN-CONV-K2   (slide-specific analytical state)  ← highest correctness risk
    4. DESIGN-CONV-B    (export preview lane transplant from #55)
    5. DESIGN-CONV-K3   (a11y / hit-testing / contrast / typography)
    Parallel exception: B has no code overlap with Q5 and may start beside Q5/K2 if agents do not share branches.
└── Wave 1 merged baseline
    └── Wave 2 (journey candidates), sequenced for file overlap:
        1. DESIGN-CONV-D   (after K1; CommandPalette)
        2. DESIGN-CONV-C   (after Q5; DashboardShell + uiSlice)
        3. DESIGN-CONV-H   (after K1 + Q5; DashboardShell + uiSlice + journey script)
        4. DESIGN-CONV-G   (StoryRail)
        5. DESIGN-CONV-I   (after K2 + G; StoryRail + session lifecycle)
└── DESIGN-CONV-A evidence on the final candidate only
Later: E (templates). Hold: F (NL), J (dark mode).
```

### File-overlap constraints (non-doc)

| Pair | Shared production files | Rule |
| :--- | :--- | :--- |
| Q5 × C / H | `DashboardShell`, `uiSlice` (± tests) | Land Q5 before C and H |
| Q5 × D | `CommandPalette` | Land Q5 before D |
| C × H | `DashboardShell`, `uiSlice`, `persistConfig` | Do not parallel author; sequence C then H or single agent |
| C × D | `CommandPalette` | Sequence D before C or combine review |
| G × I | `StoryRail` | Land G before I |
| H × I | `DashboardShell` | Sequence H before I |
| B × others | none material | Safe to parallel with Q5/K2 |

## Verification record

Performed on 29 July 2026 against `origin/main` @ `3ba5964`:

1. Listed DESIGN-CONV remotes and open PRs #49–#59, #63.
2. Recorded ahead/behind and tip SHAs for each primary ref.
3. Probed `git merge --no-commit --no-ff` in detached worktrees; classified docs-only vs code conflicts.
4. Diff-stat’d each candidate vs merge-base; confirmed intended files.
5. Grepped current `main` for feature symbols — candidates’ product behaviour is still off-line.
6. Built pairwise non-doc file overlap matrix for Wave 1/2 sequencing.
7. Confirmed Q6 audit file present and tracker row Done; K1/K2/K3 remain Not started.

**Not done in R0 (by design):** merging candidate product code; running full `npm run ci` product changes; representative-user sessions; promoting any Candidate row to Done.

## Exit gate checklist

- [x] Every candidate B–I, Q5, A, F, E, Q6 has an explicit disposition
- [x] Current `main` unchanged by candidate product merges (R0 is evidence + tracker only)
- [x] Backend-reset / engine-boot contracts not touched
- [x] Later work has one stable integration baseline SHA and ordered sequence
- [x] No candidate status silently marked Done

## Next pull

1. Merge this R0 evidence PR.
2. Start Wave 1 from `main`: **K2** (correctness) and/or **Q5** + **B** per capacity; keep one branch per tracker ID.
3. Do not start C/D/G/H/I until their Wave 1 dependencies merge.
4. Do not start E/F/A product claims until the plan’s gates say so.
