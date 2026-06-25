# PILOT-1: Pilot Build & Packaging

**Status:** Done (June 2026)  
**Scope contract:** [`docs/pilot_00_brief.md`](pilot_00_brief.md)  
**Trust evidence:** [`docs/pilot_02_trust_pack.md`](pilot_02_trust_pack.md)

This document describes how to build, host, and validate the pilot deployment of Velocity for paid pilots (PILOT-6).

---

## 1. Pilot build

### Version

Pilot builds use package version **`0.1.0-pilot`** (see root `package.json`).

### Build commands

```bash
npm ci --legacy-peer-deps
npm run typecheck:all
npm run test:run
npm run build
```

Output: `dist/` static assets (Vite production build). CI runs `npm run build` on every PR to `main` (`.github/workflows/test.yml`).

### Local preview (pilot URL simulation)

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173`. Playwright E2E uses the same port by default (`playwright.config.ts`).

### Hosting options

| Option | Notes |
| :--- | :--- |
| **Static host** (Netlify, Vercel, S3+CloudFront, internal nginx) | Serve `dist/` over **HTTPS**. Required for OPFS and secure context. |
| **Internal pilot URL** | Single HTTPS origin shared with pilots; no auth layer in PILOT-1 — add before external exposure if needed. |
| **Local file** | Not supported — `file://` lacks secure context and OPFS. |

**COOP/COEP:** DuckDB-Wasm multi-threading may require cross-origin isolation headers on the host. Verify ingest performance on the target host; dev server documents COOP/COEP in `docs/dev_01_contributing.md`.

---

## 2. Privacy language (in-product)

Pilot-facing copy is centralized in `src/constants/pilotCopy.ts` and surfaced in:

| Surface | Content |
| :--- | :--- |
| **Workspace empty state** | Full privacy detail — data stays on device, OPFS storage, `.velocity` sessions exclude respondent rows |
| **Environment banner** | Headline: respondent data never leaves device; dismissible per browser |
| **Session export modal** | Existing shield note — no respondent data in `.velocity` files |

Review checklist for pilot outreach:

- [ ] Privacy banner visible on first workspace load
- [ ] Empty-state copy matches `pilot_00_brief.md` in-scope promise
- [ ] No contradictory "cloud upload" language in UI

---

## 3. Browser limits & warnings

### Product guardrails

Implemented in `src/features/workspace/hooks/useFileUpload.ts`:

| Threshold | Behavior |
| :--- | :--- |
| ≥ 50 MB | Size warning path |
| ≥ 200 MB | Metadata-only gate (user confirms full load) |
| ≥ 40M estimated cells | High cell-risk gate |
| ≥ 20M estimated cells | Elevated risk confirm dialog |

### Environment checks

`src/lib/pilotEnvironment.ts` + `PilotEnvironmentBanner` assess on workspace load:

- Secure context (HTTPS / localhost)
- OPFS availability
- Recommended browser (Chrome/Edge/Safari desktop)
- Single-tab reminder

### Browser smoke matrix (manual PILOT-6 prep)

Run upload → crosstab → PPTX export → workspace reopen on:

| OS | Browser | Priority |
| :--- | :--- | :--- |
| macOS 14+ | Chrome 120+ | P0 |
| macOS 14+ | Safari 17+ | P0 |
| Windows 11 | Chrome 120+ | P0 |
| Windows 11 | Edge 120+ | P1 |

Record: OPFS available (Y/N), file used, ingest time, export success, any banner warnings.

Automated regression: `npm run test:e2e -- tests/e2e/pilot-workflow.spec.ts` (Chromium, OPFS required).

---

## 4. Onboarding instrumentation

Local-first event log for PILOT-0 workflow timing (T0–T3). **No external analytics** — events stay in `localStorage` until exported.

### Module

`src/services/pilotOnboarding.ts`

### Events

| Event | When | Maps to |
| :--- | :--- | :--- |
| `file_selected` | Upload starts | T0 |
| `canvas_ready` | SAV/CSV load completes | T1 |
| `first_crosstab` | First successful row×col crosstab | T2 |
| `pptx_exported` / `xlsx_exported` | Export download completes | T3 |
| `workspace_reopened` | Dataset opened from workspace library | Durability |

### Export

Workspace header → **Pilot Log** button (`data-testid="pilot-event-log-download"`) downloads `velocity-pilot-events-YYYY-MM-DD.json`.

Pilots share this file with Velocity during observed sessions (PILOT-6).

### Tests

- Unit: `src/services/pilotOnboarding.test.ts`
- E2E: `tests/e2e/pilot-workflow.spec.ts`

---

## 5. Durable project flow

Validated E2E paths:

| Flow | Spec |
| :--- | :--- |
| Upload SAV → canvas | `pilot-workflow.spec.ts`, `workspace-switch.spec.ts` |
| Workspace reopen without re-upload | `workspace-switch.spec.ts`, `opfs.spec.ts` |
| Session export | `session-export.spec.ts` |
| PPTX export | `pilot-workflow.spec.ts` |

---

## 6. Validation gates (PILOT-1)

| Gate | Result | Evidence |
| :--- | :--- | :--- |
| **T** (typecheck) | Required before deploy | `npm run typecheck:all` |
| **L** | N/A | No ESLint gate in repo |
| **U** (unit) | `pilotOnboarding.test.ts` | `npm run test:run` |
| **I** (E2E) | `pilot-workflow.spec.ts` | `npm run test:e2e` |
| **A** (architecture) | Local-only instrumentation; no core seam changes | `AGENTS.md` invariants preserved |
| **V** (market) | Deployable artifact + timing hooks for PILOT-6 | This doc + event log export |

---

## 7. Pre-pilot deploy checklist

1. `npm run build` succeeds
2. `npm run test:e2e -- tests/e2e/pilot-workflow.spec.ts` passes
3. HTTPS host serves `dist/` with secure context
4. Privacy banner and empty-state copy reviewed
5. Pilot Log export tested manually once
6. Browser smoke matrix row completed on target pilot hardware
7. Promise matches `pilot_00_brief.md` in-scope table

---

## 8. Unblocks

| ID | Workstream |
| :--- | :--- |
| PILOT-6 | Paid pilot recruiting with deployable URL + event log collection |
| PILOT-3 | PPTX template loop (not required for initial pilot deploy) |
| STAB-UI-D | P1 UX fixes — improves <5 / <15 min targets but not blocking deploy |
