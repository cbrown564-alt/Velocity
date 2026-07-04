# Design reset evidence pack

Frozen screenshot evidence for Phase 4 (WP4.1) of [`docs/plan_05_design_reset_implementation.md`](../../plan_05_design_reset_implementation.md).

Captured July 4, 2026 on `main` after the full Pathway B reset (single theme, story rail, insert palette, recipe inspector, two-pane Variable Manager).

## Compare against

| Reference | Location | Notes |
| :--- | :--- | :--- |
| **Before/after analysis** | [`before_after_analysis.html`](before_after_analysis.html) | Side-by-side comparisons, gains/losses, questions, paths forward |
| North-star mock | [`design-reset-north-star/`](../design-reset-north-star/) | Visual target (interactive `north_star.html` + static PNGs) |
| July 1 pre-reset audit | [`ui-pilot-readiness-audit/screenshots-p2-final/`](../ui-pilot-readiness-audit/screenshots-p2-final/) | Post–PR #18 baseline before design reset |
| This pack | `screenshots/` | Post-reset production UI |

## Workflow stages

| File | Stage |
| :--- | :--- |
| `00-engine-init-splash.png` | Engine initialization |
| `01-workspace-landing.png` | First-run workspace landing |
| `04-dashboard-story-rail-empty-slide.png` | Canvas with story rail (no resident variable list) |
| `05-building-crosstab-one-variable.png` | First variable inserted via palette (rows) |
| `06-crosstab-table-result.png` | Hero crosstab (sex × marital status) |
| `07-chart-view.png` | Chart view |
| `08-export-modal.png` | Export modal |
| `09-recipe-inspector.png` | Recipe inspector (slide properties) |
| `10-variable-manager.png` | Two-pane Variable Manager |
| `11-focus-mode.png` | Focus mode |
| `12-insert-palette.png` | Insert palette (⌘K) |
| `13-workspace-after-session.png` | Workspace after session |
| `14-dataset-search-reopen.png` | Dataset search / reopen |
| `15-resumed-analysis-session.png` | Resumed analysis with deck state |

Capture metadata: [`screenshots/manifest.json`](screenshots/manifest.json).

## Regenerate screenshot pack

**One command (recommended):**

```bash
npm run screenshot:design-reset-evidence
```

The script spawns the Vite dev server, runs Playwright, and writes PNGs to `docs/assets/design-reset-evidence/screenshots/`.

**Manual equivalent:**

```bash
npm run dev -- --host 127.0.0.1 --port 4173   # or rely on script-spawned server
SCREENSHOT_OUT=docs/assets/design-reset-evidence/screenshots node scripts/ui-workflow-screenshot-audit.mjs
```

**Prerequisites:** `npm install` (repo root) and Playwright browsers (`npx playwright install chromium` if missing).

Defaults: 1440×900 viewport, 2× device scale, single evolved Soft Machine theme, dataset `test_data/sleep.sav`.

**After refresh:** update `screenshots/manifest.json` (`capturedAt`, `commit`), spot-check [`before_after_analysis.html`](before_after_analysis.html) image loads, and commit PNGs + manifest together.

## PILOT-6 photography refresh (`DESIGN-CONV-A`)

Use this pack — not [`ui-pilot-readiness-audit/screenshots-p2-final/`](../ui-pilot-readiness-audit/screenshots-p2-final/) — for paid pilot outreach and deck collateral.

| When to refresh | Action |
| :--- | :--- |
| **Before PILOT-6 recruiting** | Confirm `screenshots/` matches current `main`; run `npm run screenshot:design-reset-evidence` if UI changed since `manifest.json` date |
| **After convergence UI lands** | Re-capture when `DESIGN-CONV-Q5` (focus retirement), `DESIGN-CONV-B` (export preview), or other Wave 1–3 chrome changes merge |
| **For a specific pilot build** | Set `SKIP_DEV_SERVER=1`, serve the pilot URL on port 4173, then run the screenshot command against that build |

**Outreach checklist:**

1. Run or verify screenshot pack (above).
2. Open [`before_after_analysis.html`](before_after_analysis.html) locally — confirm side-by-side “after” images render.
3. Attach key stages to outreach (`01-workspace-landing`, `06-crosstab-table-result`, `12-insert-palette`) or link the HTML review page.
4. Run 3–5 unscripted first sessions using [`docs/design_conv_a_unscripted_session_scorecard.md`](../../design_conv_a_unscripted_session_scorecard.md); update session metrics in `before_after_analysis.html` from the rollup.

## Unscripted session evidence

Scorecard template: [`docs/design_conv_a_unscripted_session_scorecard.md`](../../design_conv_a_unscripted_session_scorecard.md)

Core metrics per session: **time to first crosstab**, **palette discovery rate** (did the user find ⌘K without a prompt?), **interruption count**.

## Verification artifacts

| File | Work package | Notes |
| :--- | :--- | :--- |
| `wp42-five-minute-pass.json` | WP4.2 | Timed pass: file-drop → 3 titled slides → All Slides PPTX export |
| `wp42-five-minute-pass.pptx` | WP4.2 | Exported deck from the timed pass (candidate for WP2.4 parity) |
| `wp22-palette-open-benchmark.json` | WP2.2 | Insert palette open latency on 500-variable fixture (<100ms budget) |
| `wp24-canvas-pptx-parity.json` | WP2.4 | Structural export quality vs golden `tests/fixtures/export/sleep-report.pptx` |

Regenerate verification artifacts:

```bash
node scripts/design-reset-five-minute-pass.mjs
node scripts/design-reset-palette-open-benchmark.mjs
node scripts/report-quality/canvas-pptx-parity.mjs
```
