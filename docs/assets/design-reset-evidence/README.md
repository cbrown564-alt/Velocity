# Design reset evidence pack

Frozen screenshot evidence for Phase 4 (WP4.1) of [`docs/plan_05_design_reset_implementation.md`](../../plan_05_design_reset_implementation.md).

Captured July 3, 2026 on branch `cursor/design-reset-integration-69a6` after the full Pathway B reset (single theme, story rail, insert palette, recipe inspector, two-pane Variable Manager).

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

## Regenerate

```bash
npm run dev -- --host 127.0.0.1 --port 4173   # or rely on script-spawned server
SCREENSHOT_OUT=docs/assets/design-reset-evidence/screenshots node scripts/ui-workflow-screenshot-audit.mjs
```

Defaults: 1440×900 viewport, 2× device scale, single evolved Soft Machine theme, dataset `test_data/sleep.sav`.

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
