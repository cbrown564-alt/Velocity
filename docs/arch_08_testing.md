# Testing Architecture

This document defines Velocity's testing infrastructure, patterns, and standards.

## 1. Overview

Velocity uses a **5-layer testing pyramid** to ensure correctness at each architectural level:

```
        ┌───────────────┐
        │   Browser     │  ← Playwright (`tests/e2e/`)
        │   (E2E)       │
        ├───────────────┤
        │  Integration  │  ← Store + Worker + DuckDB
        ├───────────────┤
        │  Component    │  ← React Testing Library
        ├───────────────┤
        │    Unit       │  ← Pure functions (queryBuilder)
        ├───────────────┤
        │   Static      │  ← TypeScript compilation
        └───────────────┘
```

## 2. Technology Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (native Vite integration) |
| **@testing-library/react** | Component testing |
| **happy-dom** | Fast DOM simulation |
| **@vitest/coverage-v8** | Coverage reporting |
| **Playwright** | Browser E2E (`tests/e2e/`) |
| **GitHub Actions** | CI/CD automation |

## 3. Test Commands

```bash
npm test              # Watch mode (development)
npm run test:run      # Single run (CI)
npm run test:coverage # With coverage report
npm run test:mutation # Stryker mutation testing for src/core/
npm run typecheck:mcp # MCP package/server TypeScript contract
npm run test:ui       # Interactive UI
npm run test:e2e      # Playwright product gates (excludes @visual; CI e2e job)
npm run test:e2e:visual  # Screenshot regression (@visual tag; informational CI only)
npm run test:parity   # WASM vs Node adapter parity on golden fixtures (CI unit-coverage job)
npm run ci            # Full test workflow locally (lint through build)
npm run ci:lint       # lint-format job only (STAB-CI-14)
npm run ci:e2e        # Playwright product gates
npm run ci:full       # ci + ci:e2e (STAB-CI-14)
```

**Local bootstrap (matches CI):**

```bash
git submodule update --init --recursive   # packages/readstat-wasm
npm ci --legacy-peer-deps
npx lefthook install                      # optional pre-commit format+lint (STAB-CI-13)
npx playwright install --with-deps        # once per machine/lockfile, before ci:e2e
```

## 4. Directory Structure

```
src/
├── test/
│   ├── setup.ts              # Global setup, mocks
│   ├── fixtures/
│   │   └── variables.ts      # Mock Variable, Dataset objects
│   └── integration/
│       ├── savIngestion.test.ts
│       └── storeWorker.test.ts
├── services/
│   ├── queryBuilder.ts       # Extracted SQL generation
│   └── queryBuilder.test.ts
├── types/
│   └── index.test.ts
└── components/
    └── **/*.test.tsx

test_data/
└── sleep.sav                 # Real SAV fixture (26KB)
```

## 5. Testing Layers

### 5.1 Static Analysis
TypeScript compilation catches type errors at build time. No additional configuration needed.

### 5.2 Unit Tests
Test pure functions in isolation. Key targets:
- `queryBuilder.ts`: SQL generation for crosstabs, filters, weights
- Type guards and validation utilities

### 5.3 Component Tests
Test React components with `@testing-library/react`:
- Render correctness
- User interactions (click, drag)
- State changes via Zustand store

### 5.4 Integration Tests
Test multiple layers working together:
- Store ↔ Worker communication
- SAV parsing → Variable extraction
- DuckDB query execution

### 5.5 End-to-End Tests
Playwright specs under `tests/e2e/*.spec.ts` validate product journeys in a real browser. During stabilization (`STAB-CI-1`), E2E is the primary gate for UI/workspace/persistence behavior that Vitest coverage excludes.

**Inventory:** 13 Playwright specs. `tests/e2e/agentWorkflow.test.ts` is a **Vitest** engine workflow test (Node adapter), not Playwright — it runs in the unit-coverage job, not the `e2e` job.

**`@visual` quarantine (STAB-CI-15/16):** Specs tagged `@visual` run via `npm run test:e2e:visual` in the separate `visual-e2e` workflow (informational, non-blocking). The required `e2e` job uses `npm run test:e2e`, which excludes `@visual` via `--grep-invert`.

| Spec | Gate | Covers |
| :--- | :--- | :--- |
| `brand-tracker-workflow.spec.ts` | e2e | Load Example → brand-tracker crosstab funnel (`PILOT-DEMO-4`) |
| `crosstab-column-virtualization.spec.ts` | e2e | Wide crosstab column virtualization |
| `crosstab-virtualization.spec.ts` | e2e | Large crosstab row virtualization |
| `duckdb-arrow-smoke.spec.ts` | e2e | SAV upload → Arrow `insertArrowTable` → crosstab; COOP/COEP / `crossOriginIsolated` (`STAB-CI-5`; replaces removed `duckDbArrow.test.ts`) |
| `opfs.spec.ts` | e2e | OPFS persistence, session restore, Start Fresh |
| `performance-dashboard.spec.ts` | e2e | Performance dashboard smoke |
| `pilot-workflow.spec.ts` | e2e | Pilot onboarding + Workshop Door first-run flow |
| `production-smoke.spec.ts` | e2e (manual/perf) | Production build worker/WASM same-origin smoke (`npm run test:e2e:production`) |
| `session-export.spec.ts` | e2e | Session export round-trip |
| `session-reload.spec.ts` | e2e | Session reload after navigation |
| `visual-polish-crosstab.spec.ts` | e2e | P1 crosstab render trust anchor |
| `visual-polish-theme-table.spec.ts` | **@visual** | Sleep sex×marital crosstab DOM regression (percent cells, headers) |
| `workspace-switch.spec.ts` | e2e | Upload two datasets, switch from catalog without re-upload (`STAB-WS-1`) |

**Vitest in `tests/e2e/` (not Playwright):**

| Test file | Covers |
| :--- | :--- |
| `agentWorkflow.test.ts` | Full agent/MCP deck workflow via `VelocityEngine` + Node adapter (8 steps including commit-deck envelope) |

## 6. Fixture Data

### Mock Objects (`src/test/fixtures/variables.ts`)
Reusable test data matching `arch_02_data_model.md`:
- `mockNominalVariable`
- `mockOrdinalVariable`
- `mockScaleVariable`
- `mockDataset`

### Real Files (`test_data/`)
- `sleep.sav` (26KB): Small SPSS file with known structure for integration tests

## 7. Coverage Requirements

Global aggregate floors (all non-excluded source):

| Metric | Threshold |
|--------|-----------|
| Branches | 80% |
| Functions | 81% |
| Statements | 83% |

Per-path floors (`STAB-CI-11`; configured in `vitest.config.ts` — raise as tests land, never lower):

| Path glob | Functions | Branches | Statements |
| :--- | ---: | ---: | ---: |
| `src/core/**` | 94% | 80% | 86% |
| `src/features/**` | 70% | 75% | 80% |
| `src/components/overlays/**` | 67% | 82% | 85% |
| `src/services/**` | 75% | 80% | 60% |
| `src/store/**` | 86% | 74% | 82% |

PRs failing any global or per-path threshold will not merge.

### STAB-CI-23: features/overlays function ratchet (in progress)

**Goal:** raise per-path function floors for `src/features/**` and `src/components/overlays/**` toward the global fn floor (81% today; 82% aspirational) by landing characterization tests — never lower existing floors.

**Measured baseline (July 2026, `npm run test:run -- --coverage`):**

| Path glob | Measured fn | Current floor | Gap to 82% |
| :--- | ---: | ---: | ---: |
| `src/features/**` | 70.1% | 70% | ~12 pts |
| `src/components/overlays/**` | 67.1% | 67% | ~15 pts |

**Execution slices** (parallel-safe; add co-located `*.test.{ts,tsx}` only):

| Slice | Priority modules (fn &lt; 70%) | Notes |
| :--- | :--- | :--- |
| Overlays | `RecodeModal`, `ExportModal`, `FilterModal`, `SessionImportModal`, `DataDrawer` | Extend existing modal tests; cover cancel/error/secondary actions |
| Workspace | `WorkspaceView`, `ExportImportModal`, `WaveTimeline`, `DatasetSidebar` | Hook + component characterization; mock OPFS/store |
| Dashboard | `useDashboardDnD`, `useResolvedVariables`, `useAutoFirstCrosstab`, `StoryRail`, `DashboardToolbar`, `DataTable`, `SlideContainer` | Hooks currently untested; extend shell/toolbar tests |
| Variable manager | `VariableInspector`, `VariableManager`, `VariableList` | Inspector at ~33% fn; extend selection/filter paths |
| Harmonization UI | `HarmonizationWorkspace`, `WaveDetectionBanner`, `ValueRemapPanel`, `MappingTable` | No co-located tests yet; exclude from floor raise until first tests land |

**Ratchet policy:** land tests in a slice → re-measure aggregate fn for that glob → raise `vitest.config.ts` floor only when measured fn exceeds the new floor by ≥1 pt. Do not raise both globs in one PR unless both pass. Close STAB-CI-23 when both globs sustain ≥82% fn with updated floors.

### Mutation testing (`src/core/`)

Stryker mutation testing measures whether unit tests actually detect logic changes, not just line coverage.

```bash
npm run test:mutation       # local full gated scope (concurrency 4)
npm run test:mutation:ci    # CI entry: diff-scoped vs merge base (concurrency 2)
npm run test:mutation:full  # force full gated campaign (manual / Mutation workflow)
```

Configuration: `stryker.config.json`, `vitest.mutation.config.ts`, `scripts/run-mutation-ci.mjs`, `scripts/lib/mutationScope.mjs`. Scope is portable logic under `src/core/` with exclusions for session I/O, WASM loader glue, untested runners, and layout-only modules. Tests include co-located `src/core/**/*.test.ts` plus golden/parity suites. Stryker uses the Vitest runner only (no project-wide TypeScript checker, so `npm run typecheck:all` remains the compile gate).

| Threshold | Meaning |
|-----------|---------|
| `high` (55) | Target mutation score |
| `low` (45) | Warning band |
| `break` (40) | CI fails below this score |

**CI streamlining:** the required `mutation` job still reports on every PR, but the expensive Stryker step is **diff-scoped**:

| Plan mode | When | What runs |
|-----------|------|-----------|
| `skip` | No mutate-eligible production files changed (UI-only, test-only, lockfile-only, excluded modules) | Job green without install/Stryker |
| `scoped` | ≤8 mutate-eligible `src/core/` files changed | `stryker run --mutate <those files>` |
| `full` | Mutation config/runner changed, `MUTATION_FULL=1`, or >8 eligible files | Full gated mutate set from `stryker.config.json` |

Scope excludes session I/O, SAV loader WASM glue, analysis runners without tests, sankey layout, and other modules where mutants cannot be exercised meaningfully. Baseline (June 2026): ~46–48% score on the full gated tree. Use `npm run test:mutation:full` or `.github/workflows/mutation.yml` when you need the deep campaign.

HTML report: `reports/mutation/mutation-report.html` (gitignored). Incremental results cache locally in `reports/mutation/stryker-incremental.json` to speed repeat local full runs.

When changing mutate-eligible `src/core/` modules, run `npm run test:mutation:ci` locally (same scoping as CI) or rely on the PR `mutation` job.

### Known blind spots (stabilization)

`vitest.config.ts` still excludes some product areas without full characterization coverage: `src/components/charts/`, untested `src/store/slices/data/*` modules, `src/hooks/`, `duckDbArrow.ts` (browser path gated by Playwright smoke), and harmonization/onboarding UI below per-path floors. **STAB-CI-7 (July 2026)** removed blanket exclusions for `src/features/` and `src/components/overlays/` after 40+ co-located characterization tests landed. **STAB-CI-8** added `EngineProxy.test.ts` and `duckdbBundles.test.ts`. **STAB-CI-11** added per-path honesty thresholds. **STAB-CI-23 (July 2026)** tracks the next ratchet: features/overlays function coverage toward 82% (see §7.1). Green Vitest coverage does not imply workspace/export UI confidence — treat Playwright E2E as the product gate for excluded UI.

## 8. CI/CD Pipeline

GitHub Actions runs on every PR to `main`. The canonical merge contract has **eight stable required jobs**: seven jobs in `.github/workflows/test.yml` plus Journey Gate. Local parity: `npm run ci` (lint through build), `npm run ci:e2e` (boot prerequisite followed by product Playwright gates), `npm run journey-gate` plus `npm run test:e2e:production` (critical journey on dev and production builds), and `npm run ci:full` for the normal code gate. See `docs/playbooks/pre_pr_verification.md`.

### Merge gates summary

| Workflow | Job | Blocks merge? | Local mirror |
| :--- | :--- | :---: | :--- |
| `test.yml` | `lint-format` | Yes | `npm run ci:lint` |
| `test.yml` | `typecheck` | Yes | `npm run typecheck:all` |
| `test.yml` | `arch-guards` | Yes | worker-boundary + querybuilder-pure + design-tokens checks |
| `test.yml` | `unit-coverage` | Yes | `npm run test:run -- --coverage` + `npm run test:parity` |
| `test.yml` | `build` | Yes | `npm run build` |
| `test.yml` | `e2e` | Yes | `npm run ci:e2e` |
| `test.yml` | `mutation` | Yes; expensive step is diff-scoped (skip / scoped / full) | `npm run test:mutation:ci` when applicable |
| `journey-gate.yml` | `journey-gate` | Yes | `npm run journey-gate` + `npm run test:e2e:production` |
| `visual-e2e.yml` | `visual-e2e` | **No** (informational) | `npm run test:e2e:visual` |

All eight required jobs must complete successfully on the current, up-to-date PR head. A green subset, pending job, skipped context, legacy combined commit status, or successful Vercel deployment does **not** imply a mergeable PR.

This contract is enforced on `main`, not only documented. Branch protection requires all eight stable contexts with strict/up-to-date heads, admin enforcement, and resolved conversations; force pushes and deletion are disabled. Audit 10's deliberately failing [PR 61](https://github.com/cbrown564-alt/Velocity/pull/61) remained blocked while its required `lint-format` context failed. The exact protected implementation head and ten-pair `main` soak are linked in [Audit 10 §14](audit_10_engine_boot_ci_truth_rca_2026-07-14.md#14-evidence-inventory).

### `lint-format` job

1. **Lint**: `npm run lint` — ESLint with `--max-warnings 0` (STAB-CI-3)
2. **ESLint ratchet**: `npm run check:eslint-ratchet` — changed files vs merge base (`fetch-depth: 0`; `GITHUB_BASE_REF`)
3. **E2E companion**: `npm run check:e2e-companion` — UI trigger paths require `tests/e2e/` updates, including theme switcher and Workshop Door landing (STAB-CI-4/18)
4. **Format**: `npm run format:check`

Pre-commit hook (optional): `lefthook.yml` runs format + lint on staged files (`npx lefthook install`; STAB-CI-13).

### `typecheck` job

1. **Typecheck**: `npm run typecheck:all` (app, tests via `tsconfig.test.json`, MCP package)

### `arch-guards` job

1. `npm run check:worker-boundary`
2. `npm run check:querybuilder-pure`
3. `npm run check:design-tokens` — semantic token policy ratchet (`scripts/check-design-tokens.mjs`)

### `unit-coverage` job (needs `typecheck`)

1. **Unit/integration tests with coverage**: `npm run test:run -- --coverage` (global + per-path thresholds; see §7)
2. **Parity tests**: `npm run test:parity` — WASM vs Node adapter parity on golden fixtures (~2.4s; STAB-CI-9)

Includes Vitest suites such as `tests/e2e/agentWorkflow.test.ts` (engine workflow, not Playwright).

### `build` job (needs `unit-coverage`)

1. **Production build**: `npm run build`

### `e2e` job (needs `lint-format`, `typecheck`; parallel with guards/coverage/build)

1. **Playwright boot prerequisite**: clean shell, real visible upload, worker/DuckDB phase trace, and failure-to-memory recovery. The `product` project depends on this project, so a boot failure skips dependents with the explicit Playwright dependency classification.
2. **Playwright product suite**: `npm run test:e2e` — excludes `@visual` screenshot regression. Traces and screenshots are retained on failure.

### `journey-gate` workflow

1. `npm run journey-gate` runs the five-minute path against Vite dev, writes timing and causal diagnostics in `finally`, and enforces the frozen cold/warm/export/wave budgets.
2. `npm run test:e2e:production` builds the application and runs the boot/upload contract plus production smoke against `vite preview`.
3. The artifact upload is unconditional and includes the structured boot trace, browser console/page/network diagnostics, screenshot, DOM, Playwright trace, Vite stdout/stderr, and timing reports.

`scripts/engine-boot-experiment.mjs` is the repeated diagnostic/soak harness. It records per-phase durations, bundle, persistence outcome, and failure phase across dev/preview, OPFS/memory, service-worker, storage, concurrency, and start-action cells.

### `visual-e2e` workflow (`.github/workflows/visual-e2e.yml`; STAB-CI-16)

Runs `npm run test:e2e:visual` (`@visual` tag only). **`continue-on-error: true`** — failures are informational until Linux baselines stabilize. Update snapshots locally with `npm run test:e2e:visual:update`.

### Stable mutation job

The required `mutation` job lives in `test.yml` and is present on every PR. It plans against the PR base (or push before SHA) via `scripts/run-mutation-ci.mjs`: **skip** when no mutate-eligible production files changed; **scoped** `--mutate` for ≤8 eligible files; **full** gated campaign when mutation config/runner changes, more than eight eligible files change, or `MUTATION_FULL=1`. Lockfile-only and test-only `src/core/**` diffs no longer trigger the hour-long campaign. A `workflow_dispatch` rerun on `Test` treats the checked-out commit as a no-change skip. `.github/workflows/mutation.yml` remains the manual **full** deep-run workflow and is not a required context.

### Red-main ownership

`.github/workflows/red-main-incident.yml` creates or updates the open `STOP: required main check is red` issue when Test or Journey Gate fails or times out on `main`. Required-check failure owns stabilization work before feature promotion resumes.

1. **Mutation testing**: `npm run test:mutation:ci` (diff-scoped Stryker + Vitest; 40% break threshold on the planned mutate set)

Run locally when touching mutate-eligible `src/core/**` even if CI would skip unrelated paths.

### CI bootstrap (`STAB-CI-21`)

Every job checks out with `submodules: recursive` (WASM SAV reader), installs via `npm ci --legacy-peer-deps`, and uses Node 20. The `lint-format` job uses `fetch-depth: 0` so ESLint/E2E ratchet scripts can diff against the PR merge base. Workflow concurrency cancels superseded runs on the same ref.

### CI artifacts (`STAB-CI-20`)

| Artifact | Job | When uploaded | Retention |
| :--- | :--- | :--- | :--- |
| `coverage-report` | `unit-coverage` | always | 7 days |
| `playwright-report` | `e2e` | on failure | 7 days |
| `playwright-test-results` | `e2e` | on failure | 7 days |
| `visual-playwright-report` | `visual-e2e` | on failure | 7 days |

Download from the GitHub Actions run summary when debugging CI-only failures.

## 9. Writing New Tests

### Naming Convention
- Unit/Component: `ComponentName.test.tsx` or `moduleName.test.ts`
- Integration: `src/test/integration/featureName.test.ts`

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';

describe('ComponentName', () => {
  it('should do expected behavior', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## 10. Scaling for Future Phases

| Phase | Testing Additions |
|-------|-------------------|
| **2.1 Variable Sets** | Unit tests for grouping logic |
| **2.2 Weighting** | Integration tests with known weighted totals |
| **2.3 PowerPoint** | Snapshot tests for slide structure |
| **3.1 WebR** | Integration tests with known R outputs |
