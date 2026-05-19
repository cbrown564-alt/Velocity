# Session 9 — Performance Perception

**Date:** May 19, 2026  
**Driver:** Agent (cursor-ide-browser) + Playwright timing  
**Build:** `http://127.0.0.1:4174/`  
**Focus:** §8 Session 9 — UX latency, loading states, progress honesty  
**Fixtures:** F1 `mock_data.csv` (browser); F2 via `workspace-switch.spec.ts` (6.7s switch)

## Methods

| Technique | Application |
| :--- | :--- |
| Cold load timing | New browser tab; engine init → workspace |
| Same-dataset reopen | Open `mock_data.csv` from Workspace (no `uploading` mode) |
| Crosstab recompute | Sidebar clicks `gender` → `region`; table ↔ chart |
| Code audit | `App.tsx` upload overlay, `analysisSlice` `isQuerying`, `EngineProxy.onProgress` |
| Console | OPFS / DuckDB errors on parallel tabs |
| Automated baseline | `workspace-switch.spec.ts` — 6.7s SAV switch |

## Perceived latency — task results

| Flow | Result | Notes |
| :--- | :--- | :--- |
| Engine cold start | **Partial** | ~3–4s to workspace; spinner only, no % (UXR-039) |
| Open same dataset (F1) | **Pass** | Instant `dashboard` — no false loading overlay |
| First crosstab (F1) | **Pass** | Row/column clicks feel immediate on warm engine |
| Table ↔ chart | **Pass** | Toggle instant; chart controls appear without blank flash |
| Deck with 7 slides | **Pass** | Timeline navigable; no obvious jank (F1 scale) |
| SAV workspace switch (F2) | **Pass (automated)** | 6.7s end-to-end — acceptable with overlay if honest |
| Rapid variable changes | **Not measured** | `isQuerying` overlay too fast to see on F1 (UXR-038) |

## Loading & progress honesty

### Strengths

- **`isQuerying` overlay** on slide canvas (`DashboardShell`) — spinner + backdrop when worker runs crosstab.
- **Export guard** — export disabled while `isQuerying` (`ExportModal`).
- **Uploading mode** — full-screen overlay + top accent bar during dataset open/upload.
- **Same-dataset shortcut** — `useWorkspaceOpen` skips `uploading` when ID matches (good perceived speed).
- **Virtualized sidebar** — `VirtualizedVariableList` ready for large catalogs.

### Issues

| ID | Severity | Summary |
| :--- | :--- | :--- |
| UXR-036 | P1 | Top progress bar animates 1.2s regardless of worker `loadProgress`; `EngineProxy.onProgress` never wired to UI |
| UXR-037 | P1 | Crosstab failures only `console.error`; slide shows title/shelves but no table/chart error state |
| UXR-038 | P2 | `isQuerying` overlay has no `aria-busy` / live region; too fast to perceive on F1 |
| UXR-039 | P2 | Engine init copy is indeterminate; DuckDB WASM init can take seconds with no row/phase feedback |
| UXR-040 | P1 | Second tab: OPFS access-handle errors → sidebar **Storage Issue** + silent query failure; no “close other tabs” guidance |
| UXR-014 | P2 | *(open)* Filter value list still flashes stale options while loading — deferred from Session 8 |

## Console observations (Session 9)

- Parallel review tabs triggered repeated `createSyncAccessHandle` failures; worker fell back to repair DB paths.
- `[AnalysisSlice] Query error: Table with name main does not exist` — UI did not surface error; user sees empty analysis chrome.
- Single-tab cold load in prior sessions had clean console; multi-tab is a reproducible stress case for Session 10.

## Heuristic snapshot (performance / status)

| # | Heuristic | Workspace | Canvas | Comment |
| :---: | :--- | :---: | :---: | :--- |
| 1 | Visibility of system status | 2 | 2 | Upload bar misleading; query errors invisible |
| 5 | Error prevention | — | 2 | Failed queries leave misleading empty slide |
| 9 | Help users recover | 1 | 2 | Storage Issue label exists but cause opaque in multi-tab |

Scores 0–4; lower is better.

## Validations

| Item | Verdict |
| :--- | :--- |
| F1 analysis loop speed | **Pass** (warm engine) |
| `workspace-switch.spec.ts` | **Pass** (6.7s) |
| UXR-005 deferred toast | **Still fixed** (no toast on empty slide 7) |
| Session 8 filter skeleton (UXR-014) | **Still open** |

## Recommended next session (10 — Errors & edge cases)

- User-visible crosstab failure state (UXR-037) + OPFS multi-tab messaging (UXR-040)
- Import corrupt session, delete dataset, modal cancel paths
- Filter modal loading guard (UXR-014)
- Human pass: large SAV upload with real progress bar

## Code references (audit)

- Upload progress: `App.tsx` lines 653–679 — fixed `duration: 1.2` animation
- Query status: `analysisSlice.ts` `isQuerying`; catch block logs only
- Progress API: `EngineProxy.ts` `onProgress` for `engine.loadProgress` — not consumed in app layer
- Canvas overlay: `DashboardShell.tsx` ~623–627
