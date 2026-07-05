# UI pilot-readiness screenshot pack

Frozen evidence for [`docs/audit_07_pilot_presentation_readiness_2026-07-01.md`](../../audit_07_pilot_presentation_readiness_2026-07-01.md).

## Directories

| Directory | When | Use |
| :--- | :--- | :--- |
| `screenshots/` | July 1, 2026 (pre-fix baseline) | Before state referenced in audit §3 stage-by-stage findings |
| `screenshots-after-ppr/` | PR #18 P0 bundle | Intermediate after P0 fixes |
| `screenshots-p1-final/` | PR #18 P1 bundle | Intermediate after P1 fixes |
| `screenshots-p2-final/` | PR #18 P2 bundle (sign-off) | **Authoritative post-fix evidence** — gate closed July 2, 2026 |

## Workflow stages (each pack)

| File | Workflow stage |
| :--- | :--- |
| `00-engine-init-splash.png` | Engine initialization |
| `01-workspace-landing.png` | Empty workspace |
| `04-dashboard-variable-browser.png` | Pre-analysis canvas |
| `05-building-crosstab-one-variable.png` | First variable on shelf |
| `06-crosstab-table-result.png` | Hero crosstab output |
| `07-chart-view.png` | Chart view |
| `08-export-modal.png` | Export modal |
| `09-variable-manager.png` | Variable Manager |
| `10-focus-mode.png` | Focus mode |
| `11-command-palette.png` | Command palette (⌘K) |
| `12-workspace-after-session.png` | Workspace after session |
| `13-dataset-search-reopen.png` | Dataset search / reopen |
| `14-resumed-analysis-session.png` | Resumed analysis |
| `15-analysis-settings.png` | Statistical settings overlay |

## Regenerate

```bash
node scripts/ui-workflow-screenshot-audit.mjs
cp /opt/cursor/artifacts/screenshots/ui-workflow-audit/*.png docs/assets/ui-pilot-readiness-audit/screenshots-p2-final/
```

Defaults: 1440×900 viewport, 2× device scale, Soft Machine theme, dataset `test_data/sleep.sav`.

After regenerating, update [`audit_07`](../../audit_07_pilot_presentation_readiness_2026-07-01.md) changelog if visual contracts changed.
