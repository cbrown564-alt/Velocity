# User journey screenshot pack

Frozen evidence for [`docs/user_journey_screenshots.md`](../../user_journey_screenshots.md).

**Captured:** July 3, 2026  
**Viewport:** 1440×900 @2×  
**Theme:** Soft Machine (default)  
**Dataset:** `test_data/sleep.sav` (271 rows, 59 cols)

## Files by journey

### Journey 1 — Activation (Workspace → first crosstab)

| File | Stage |
| :--- | :--- |
| `00-engine-init-splash.png` | Engine initialization |
| `01-workspace-landing.png` | Empty workspace |
| `04-dashboard-variable-browser.png` | Pre-analysis canvas |
| `05-building-crosstab-one-variable.png` | First variable on shelf |
| `06-crosstab-table-result.png` | Hero crosstab output |

### Journey 2 — Presentation & export (Canvas → deck → PPTX)

| File | Stage |
| :--- | :--- |
| `06-crosstab-table-result.png` | Crosstab slide (hero artifact) |
| `07-chart-view.png` | Chart view |
| `10-focus-mode.png` | Focus mode |
| `08-export-modal.png` | Export modal |
| `15-analysis-settings.png` | Statistical settings overlay |

### Journey 3 — Durability & organization (Return → reopen → power tools)

| File | Stage |
| :--- | :--- |
| `12-workspace-after-session.png` | Workspace after session |
| `13-dataset-search-reopen.png` | Dataset search / reopen |
| `14-resumed-analysis-session.png` | Resumed analysis |
| `09-variable-manager.png` | Variable Manager overlay |
| `11-command-palette.png` | Command palette (⌘K) |

## Regenerate

```bash
# Start dev server (or use existing)
npm run dev -- --host 127.0.0.1 --port 4173

# Capture (with server already running)
SKIP_DEV_SERVER=1 SCREENSHOT_OUT=docs/assets/user-journey-screenshots \
  node scripts/ui-workflow-screenshot-audit.mjs
```

Script: [`scripts/ui-workflow-screenshot-audit.mjs`](../../../scripts/ui-workflow-screenshot-audit.mjs)
