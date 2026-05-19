# Session 0 — Browser Reconnaissance

**Date:** May 19, 2026  
**Driver:** Agent (cursor-ide-browser)  
**Build:** `http://127.0.0.1:4174/` (Vite dev)  
**Fixture:** F1 Load Example (`mock_data.csv`, 250 rows)  
**Themes exercised:** Soft Machine (default), Mission Control

## Paths walked

1. Cold load → engine init → Workspace empty state  
2. Load Example → Canvas empty → suggested starting point `gender` → sidebar `region` → crosstab populated  
3. Theme toggle → Mission Control visual pass  
4. `D` → Variable Manager open → `D` again → unintended slide duplicates  
5. Esc → Manager closed  
6. Focus mode `F` on/off  
7. Export modal opened (accessible structure verified); Cancel/close not fully exercised  
8. Did **not** complete: Workspace return with active modal, filter modal, chart toggle, F2 SAV upload, harmonization

## Positive signals

- Workspace empty state is inviting; Upload vs Load Example hierarchy is clear.  
- Suggested starting points successfully bootstrap first table.  
- Crosstab + significance legend readable in both light and dark themes.  
- Export modal labeling is a good accessibility reference for other overlays.  
- Focus mode successfully hides chrome for presentation posture.

## Regressions / risks logged

See `findings.md` UXR-000 through UXR-005. **Highest priority:** UXR-000 shortcut conflict before Session 3 deck testing.

## Screenshots

Capture manually into `screenshots/` on next human pass (agent descriptions only in Session 0).

## Next session

**Session 1** — J1/J2 with F2 `test_small.sav`, clean profile, workspace reopen per `tests/e2e/workspace-switch.spec.ts`.
