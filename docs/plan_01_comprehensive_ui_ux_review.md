# Comprehensive UI/UX Review Program

**Status:** Active (multi-session)  
**Created:** May 19, 2026  
**Owner:** Product + engineering (assign per session in §8)  
**Scope:** Full Velocity human-facing surface — Workspace, Analysis Canvas, Variable Manager, harmonization, modals, themes, session/portability flows.

This document is the **master plan** for the most rigorous user-facing evaluation Velocity has run to date. It separates **UI testing** (visual and interaction fidelity) from **UX testing** (task success and product fit), runs both in parallel, and produces ranked, evidence-backed findings for the `STAB-UI-*` workstream and tracker.

---

## 1. Goals and non-goals

### Goals

1. **Map the full user journey** from first visit through analysis, deck building, export, and return visits (workspace reopen, session import).
2. **Judge look and feel** against `design_01_system.md` and `design_02_ux_modes.md` — themes, density, hierarchy, motion, trust signals.
3. **Find blocking UX failures** (confusing modes, lost work, wrong shortcuts, broken flows) before deep polish.
4. **Produce a prioritized backlog** with severity, mode ownership, and links to screenshots/session notes.
5. **Establish repeatable review rituals** (fixtures, scripts, rubrics) for future releases.

### Non-goals (this program)

- Replacing automated tests or agent capability evals (`eval_framework.md`).
- Statistical correctness (use `playbooks/stats_integrity.md` when findings touch numbers).
- Phase 5+ feature invention — findings inform stabilization and `STAB-UI-*` only unless escalated via tracker.

---

## 2. Relationship to existing work

| Artifact | Role in this program |
| :--- | :--- |
| `design_01_system.md` | Visual contract (tokens, themes, typography) |
| `design_02_ux_modes.md` | Mode boundaries and responsibilities |
| `playbooks/ui_mode_change.md` | How fixes must respect mode separation |
| `audit_02_ui_gap_analysis_2026-05-19.md` | Hypothesis backlog (motion, onboarding, density, themes) — **validate or reject** with evidence |
| `archive/2026-05/audits/audit_03_frontend_ui_maturity_2026-05-19.md` | Structural issues (monoliths, token drift, z-index) — spot-check in browser |
| `tracker_00_implementation_status.md` §4.7 | `STAB-UI-A/B` Done; `STAB-UI-C` Not started — findings feed C and follow-on rows |
| `arch_08_testing.md` | E2E gaps; extend Playwright where sessions find regressions |

**Rule:** This program **supersedes ad-hoc UI opinions** until Session 12 synthesis is merged into tracker/audit docs. New findings get IDs here first (`UXR-###`).

---

## 3. Methodology: UI testing vs UX testing

Industry practice treats these as complementary, not interchangeable ([NN/g heuristic evaluation](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/); [Maze usability plan checklist](https://maze.co/guides/usability-testing/plan)).

### 3.1 UI testing (visual and interaction fidelity)

**Question:** Does the interface *look and behave* as designed, consistently, across states?

| Technique | When | Velocity application |
| :--- | :--- | :--- |
| **Heuristic visual audit** | Every session | Compare to Soft Machine / Mission Control / Liquid Glass specs in `design_01_system.md` |
| **Component consistency pass** | Sessions 7, 8 | Modals, chips, shelves, tables, toasts — same tokens, radius, shadows |
| **State coverage** | All sessions | Default, hover, focus, active, disabled, loading, error, empty |
| **Responsive/layout** | Session 11 | 1280, 1440, 1920; narrow width for Manager collapse |
| **Cross-theme** | Session 7 | All themes on same fixture; chart/table token parity |
| **Motion audit** | Session 8 | `prefers-reduced-motion`, enter/exit, layout shift (`STAB-UI-A` claims) |
| **Token CI cross-check** | Session 7 | `npm run check:design-tokens` + note any browser-only violations |
| **Visual regression (optional)** | Session 11+ | Playwright screenshots per theme/mode if worth automating |

**UI checklist dimensions** (adapted from common 2024 UI QA practice — layout, typography, color, icons, forms, feedback, compatibility):

- Layout alignment and grid rhythm  
- Typography roles (display vs UI vs mono)  
- Color contrast and semantic token usage (no raw palette drift)  
- Iconography and affordances (drag handles, close buttons)  
- Control states and focus visibility  
- Loading/skeleton vs blank flash  
- Z-index / overlay stacking  

### 3.2 UX testing (task success and product fit)

**Question:** Can a representative user **accomplish real research jobs** with confidence?

| Technique | When | Velocity application |
| :--- | :--- | :--- |
| **Scenario-based task testing** | Sessions 1–6 | Scripted tasks with success criteria (§6) |
| **Think-aloud (optional)** | Sessions 1, 4, 5 | Record confusion quotes; not required for agent-led passes |
| **Heuristic evaluation** | Every session | Nielsen’s [10 heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) — 3–5 evaluators ideal; minimum 1 agent + 1 human for sign-off |
| **First-use / returning-user** | Sessions 1, 5 | Empty workspace vs reopen/import |
| **Error recovery** | Session 10 | Failed ingest, corrupt session, delete dataset, cancel modals |
| **Keyboard / power-user** | Session 8 | Shortcuts documented vs actual; conflicts |

**UX metrics to capture per task:**

- **Outcome:** success / partial / fail  
- **Time** (approximate; agent sessions use step count as proxy)  
- **Severity if fail:** P0 blocker → P3 polish (§7)  
- **Mode violated?** (Workspace / Canvas / Manager)  
- **Trust impact?** (local-only data, export, stats labels)

**Important:** Heuristic evaluation finds problems early but does not replace task testing ([NN/g](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/)). This program uses **both**.

---

## 4. Review principles

1. **Mode separation** — Flag anything that blurs Workspace vs Canvas vs Variable Manager (`design_02_ux_modes.md`).
2. **Local-first trust** — Persistence, export, and “data never leaves device” messaging must be accurate and timely.
3. **Survey-native literacy** — Labels, defaults, and empty states should speak to researchers (N, weight, sig tests), not generic BI.
4. **Evidence over taste** — Every `UXR-###` links to screenshot path, URL/state, or short screen recording note.
5. **Big picture first** — Sessions 0–6 prioritize journeys; Sessions 7–11 deepen visual/a11y/edge; Session 12 prioritizes.
6. **Same fixtures** — Use §5 datasets so results are comparable across sessions and themes.

---

## 5. Environment, tools, and fixtures

### Environment

```bash
npm run dev -- --port 4174 --host 127.0.0.1
# Browser: http://127.0.0.1:4174/
```

- **Browser agent:** Cursor `cursor-ide-browser` — snapshot before each interaction; screenshot at mode boundaries and findings.
- **Human pass:** Same URLs; confirm agent-only blind spots (trust, “feel”, stat literacy).
- **Console:** `browser_console_messages` on any error or failed interaction.

### Standard fixtures

| ID | File | Use |
| :--- | :--- | :--- |
| F1 | Built-in **Load Example** (`mock_data.csv`, 250 rows) | Fast Canvas/Manager/deck passes |
| F2 | `test_data/fixtures/test_small.sav` | Real ingest, workspace persistence |
| F3 | Eval session | `evals/eval-01/runs/run-2026-03-13/artifacts/session.velocity` (import) |
| F4 | Large SAV (if available locally) | Guardrails, sample mode — only if operator has file |

### Themes (rotate each session block)

1. **Soft Machine** (default)  
2. **Mission Control**  
3. **Liquid Glass** (when testing Session 7)

### Personas (evaluate tasks from their lens)

| Persona | Primary mode | Typical jobs |
| :--- | :--- | :--- |
| **P1 — First-time analyst** | Workspace → Canvas | Load data, first crosstab, understand sig markers |
| **P2 — Returning power user** | Workspace + Canvas | Reopen dataset, duplicate slide, export PPTX, keyboard flow |
| **P3 — Data gardener** | Variable Manager | Find variable, recode, folders, inspect distribution |
| **P4 — Longitudinal lead** | Workspace + harmonization | Link waves, harmonize, trust mapping UI |
| **P5 — Stakeholder reader** | Canvas (read/export) | Focus mode, clean deck, export for meeting |

---

## 6. Journey map and task scripts

Each task: **steps → success criteria → UI notes → UX notes**.

### J1 — First launch and orientation (Workspace)

| Step | Action |
| :--- | :--- |
| 1 | Cold load app; observe splash / engine init |
| 2 | Read empty state; try search, tabs (Recent, Starred, Projects, All) |
| 3 | Use **Load Example** and **Upload** affordances (upload may use F2) |

**Success:** User understands local-only model and next action without docs.  
**UI:** Hierarchy, typography, storage meter, tab clarity.  
**UX:** No dead ends; tab labels match content when empty.

### J2 — Enter analysis (Workspace → Canvas)

| Step | Action |
| :--- | :--- |
| 1 | Open dataset from library card |
| 2 | Note transition, sidebar, toast, session messaging |
| 3 | Return to Workspace and reopen same dataset |

**Success:** Reopen restores slide/deck state predictably (tracker stabilization priority).  
**UI:** Transition cohesion (instant cut vs intentional motion).  
**UX:** User not surprised by data loss warnings.

### J3 — Build first analysis (Canvas)

| Step | Action |
| :--- | :--- |
| 1 | Use suggested starting points and sidebar clicks |
| 2 | Row + column + optional weight |
| 3 | Toggle table/chart; open statistical settings |
| 4 | Add filter; verify N and table update |

**Success:** Crosstab/chart matches intent; sig legend understandable.  
**UI:** Shelf density, table hierarchy, chart tokens.  
**UX:** Discoverability without reading manual.

### J4 — Deck and presentation (Canvas)

| Step | Action |
| :--- | :--- |
| 1 | New slide (N), navigate (←/→), duplicate (⌘/Ctrl+D) |
| 2 | Edit title/subtitle; Focus mode (F) |
| 3 | Timeline dock: delete with confirm when >1 slide |

**Success:** Deck tells a story; focus mode hides chrome appropriately.  
**UI:** Timeline legibility, slide chrome.  
**UX:** Shortcuts match labels; **no conflicting bindings**.

### J5 — Variable Manager (spoke)

| Step | Action |
| :--- | :--- |
| 1 | Open Manager (documented shortcut / control) |
| 2 | Search, facets (Type/Status/Quality), Miller navigation |
| 3 | Inspect variable; edit label if supported |
| 4 | Close via Esc, close control, and Canvas toggle |

**Success:** User can find and understand a variable without losing Canvas context.  
**UI:** Column collapse at narrow widths; inspector layout.  
**UX:** Clear exit; selection vs close behavior on Esc.

### J6 — Export and portability

| Step | Action |
| :--- | :--- |
| 1 | Export modal: current / all / selected slides |
| 2 | Export Session `.velocity`; re-import on fresh profile or after clear |
| 3 | PPTX export (manual verify file opens) |

**Success:** Round-trip preserves deck; PPTX acceptable for stakeholder.  
**UI:** Modal structure, option copy.  
**UX:** User trusts backup story.

### J7 — Data gardening and harmonization (extended)

| Step | Action |
| :--- | :--- |
| 1 | Data drawer (D if distinct), recode modal, filter modal |
| 2 | Open harmonization workspace (if multi-wave fixture available) |
| 3 | Projects tab: create/link project (F2 + workspace flows) |

**Success:** Advanced jobs reachable without breaking mode rules.  
**UI:** Overlay stacking, z-index, modal consistency.  
**UX:** User knows which mode they are in.

---

## 7. Severity and finding IDs

| Severity | Definition | Example |
| :--- | :--- | :--- |
| **P0** | Blocks core job or causes data loss / wrong analysis | Shortcut duplicates slides when opening Manager |
| **P1** | Major friction or trust break | Workspace reopen loses deck |
| **P2** | Noticeable polish or inconsistency | Raw Tailwind on dashboard shell |
| **P3** | Nice-to-have | Page transition between modes |

**ID format:** `UXR-###` (sequential in `docs/reviews/ui_ux_review_findings.md` — create in Session 1).

---

## 8. Session plan (multi-session)

| Session | Focus | Primary methods | Est. duration |
| :--- | :--- | :--- | :--- |
| **0** | Reconnaissance + this plan | Browser agent pass, F1 example | 2–3 h (done May 19) |
| **1** | J1, J2 — Workspace, ingest, reopen | UX tasks + UI empty states | 3–4 h |
| **2** | J3 — Canvas analysis core | UX tasks + UI table/chart | 3–4 h |
| **3** | J4 — Deck, timeline, focus | UX keyboard + UI timeline | 3 h |
| **4** | J5 — Variable Manager depth | UX + UI Miller/inspector | 3–4 h |
| **5** | J6 — Export/session | UX trust + UI modals | 3 h |
| **6** | J7 — Recode, harmonization, projects | UX mode boundaries | 4 h |
| **7** | Themes + visual system | UI audit all themes, F1 | 3 h |
| **8** | Accessibility + keyboard | UI focus/contrast + UX shortcuts | 3 h |
| **9** | Performance perception | UX latency, loading states | 2–3 h |
| **10** | Errors, edge cases, empty states | UX recovery | 3 h |
| **11** | Responsive + browser matrix | UI layout | 3 h |
| **12** | Synthesis + tracker updates | Prioritization workshop | 4 h |

**Cadence:** One session per sitting; update findings doc after each. Session 12 merges into `audit_02` addendum or new `audit_06_ui_ux_review_2026-06.md` (archive when superseded).

**Roles per session:**

- **Driver** — runs browser/steps  
- **Scribe** — logs `UXR-###`  
- **Human sign-off** — required for P0/P1 before implementation  

---

## 9. Evidence standards

Store under `docs/reviews/ui_ux_review_2026-05/` (create in Session 1):

```
docs/reviews/ui_ux_review_2026-05/
  session-00-recon.md          # Agent notes
  session-01-workspace.md
  ...
  screenshots/
    S1-J1-workspace-empty.png
  findings.md                  # UXR-### register
```

Each finding entry:

```markdown
### UXR-001 — Short title
- **Severity:** P0
- **Mode:** Canvas
- **Session:** 0
- **Steps to reproduce:** ...
- **Expected / Actual:** ...
- **Screenshot:** screenshots/...
- **Heuristic:** #3 User control
- **Related:** STAB-UI-C, TimelineDock.tsx
```

---

## 10. Session 0 — Reconnaissance summary (May 19, 2026)

**Method:** Browser agent on `http://127.0.0.1:4174/`, F1 Load Example, Soft Machine ↔ Mission Control, partial J3–J6.

### What is working (big picture)

| Area | Observation |
| :--- | :--- |
| **Workspace first impression** | Warm, calm empty state; clear primary Upload vs secondary Load Example; local-storage meter visible |
| **Onboarding path** | Load Example → Canvas is fast; smart empty state with **suggested starting points** lowers first-analysis friction |
| **Core analysis loop** | Click suggestions + sidebar → row/column shelves → crosstab with sig markers and legend is credible and readable |
| **Theme switching** | Mission Control is cohesive; chart/table remain legible on dark |
| **Variable Manager** | Miller columns, facets, and type summary match `design_02` “data gardening” spoke |
| **Export modal** | Strong accessible names (radios, checkboxes, report title); live region announces open |
| **Focus mode** | `F` toggles chrome; label updates to Exit Focus Mode |
| **Trust messaging** | Local-only copy on workspace and session toast aligns with product promise |

### Issues to validate in dedicated sessions (candidate findings)

| ID | Severity | Finding | Next session |
| :--- | :--- | :--- | :--- |
| UXR-000 | ~~P0~~ **Fixed** | **`D` key conflict** — resolved May 19: `D` = Variable Manager; `⌘/Ctrl+D` = duplicate slide (see §14) | — |
| UXR-001 | ~~P1~~ **Fixed** | Header label **“Variables”** + `D` (was “Data D”) | — |
| UXR-002 | P2 | **Workspace → Canvas** is an instant cut (no shared-element transition); acceptable but noted in gap analysis | Session 7 |
| UXR-003 | P2 | **Slide title noise:** Duplicate slide names propagate to export modal (“Analysis 1 (Copy) (Copy)”) | Session 3, 5 |
| UXR-004 | P2 | **Variable Manager close control** — icon-only button without accessible name in snapshot | Session 4, 8 |
| UXR-005 | P3 | **Toast timing** — session backup toast competes with first-run exploration | Session 2 |

### Not yet exercised (must not skip)

- Real `.sav` upload (F2), OPFS persistence, workspace delete/switch (`tests/e2e/workspace-switch.spec.ts` scenarios)  
- Chart view toggle and D3 readability per theme  
- Filter / recode / weight modals end-to-end  
- Harmonization workspace and Sankey  
- ~~Liquid Glass theme~~ (Session 7 — immaturity logged UXR-030/031)  
- Import Session round-trip  
- Actual PPTX binary quality  
- Mobile/narrow breakpoints  
- `prefers-reduced-motion` in OS settings  

---

## 11. Deliverables

| Deliverable | When |
| :--- | :--- |
| This plan | Session 0 |
| `docs/reviews/ui_ux_review_2026-05/findings.md` | Session 1+ |
| Per-session notes + screenshots | After each session |
| **Synthesis report** (`audit_06` or `audit_02` addendum) | Session 12 |
| Tracker updates (`STAB-UI-C`, new rows) | Session 12 |
| Playwright additions for P0/P1 regressions | As fixes land |

---

## 12. Heuristic evaluation worksheet (quick reference)

Rate each heuristic **0** (no issue) – **4** (usability catastrophe) per major screen. Copy into session notes.

| # | Heuristic | Workspace | Canvas | Var. Manager |
| :---: | :--- | :---: | :---: | :---: |
| 1 | Visibility of system status | | | |
| 2 | Match real world | | | |
| 3 | User control & freedom | | | |
| 4 | Consistency & standards | | | |
| 5 | Error prevention | | | |
| 6 | Recognition vs recall | | | |
| 7 | Flexibility & efficiency | | | |
| 8 | Aesthetic & minimalist design | | | |
| 9 | Help users recover from errors | | | |
| 10 | Help & documentation | | | |

---

## 13. Session status (updated May 19, 2026 — Session 9 complete)

| Session | Status | Notes |
| :--- | :--- | :--- |
| 0 | Done | Recon + plan committed (`d69d513`) |
| 1 | Done | Workspace/reopen (`6a48fb4`); Playwright SAV switch pass |
| 2 | Done | Canvas core J3 — `session-02-canvas.md`; UXR-010–016 logged |
| 3 | Done | Deck/timeline/focus — `session-03-deck.md`; UXR-003/005/017 |
| 4 | Done | Variable Manager J5 — `session-04-variable-manager.md`; UXR-018–020 |
| 5 | Done | Export/session J6 — `session-05-export.md`; UXR-021–023; P0 import fix |
| 6 | Done | J7 advanced — `session-06-advanced.md`; UXR-024–026; harmonization needs 2-wave human pass |
| 7 | Done | Themes/visual — `session-07-themes.md`; UXR-027–031 |
| 8 | Done | A11y/keyboard — `session-08-accessibility.md`; UXR-032–035; fixes for 004/012/032–035 |
| 9 | Done | Performance — `session-09-performance.md`; UXR-036–040 |
| 10+ | Pending | Errors, edge cases, empty states next |

**Pre–Session 3 gate (complete):** UXR-000 shortcut conflict fixed — see §14.

---

## 14. Keyboard shortcut registry (canonical)

Single source of truth for review sessions and `STAB-UI-C` shortcut reference (`?`). Modifiers use **⌘** on macOS and **Ctrl** on Windows/Linux unless noted.

| Key | Context | Action | Owner |
| :--- | :--- | :--- | :--- |
| `D` | Canvas (not in input) | Toggle Variable Manager overlay | `AppShell` |
| `⌘/Ctrl+D` | Canvas, active slide (not in input) | Duplicate active slide | `TimelineDock` |
| `F` | Canvas (not in input) | Toggle Focus Mode | `AppShell` |
| `N` | Canvas (not in input) | New slide | `TimelineDock` |
| `←` / `→` | Canvas (not in input) | Previous / next slide | `TimelineDock` |
| `Delete` / `Backspace` | Canvas, >1 slide | Delete slide (confirm modal) | `TimelineDock` |
| `Esc` | Variable Manager | Clear selection, then close | `VariableManager` |
| `⌘/Ctrl+A` | Variable Manager | Select all visible variable sets | `VariableManager` |

**Rules for new shortcuts**

1. Register every binding here before shipping; Session 8 audits this table against code.  
2. Do not reuse the same unmodified key in two `document` listeners.  
3. Prefer industry defaults (`⌘/Ctrl+D` = duplicate) over ad-hoc letter keys.

---

## References

- Nielsen Norman Group — [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), [How to Conduct a Heuristic Evaluation](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/)  
- Maze — [Usability testing plan checklist](https://maze.co/guides/usability-testing/plan)  
- Velocity — `design_01_system.md`, `design_02_ux_modes.md`, `audit_02_ui_gap_analysis_2026-05-19.md`, `arch_08_testing.md`
