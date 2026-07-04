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

### Mutation testing (`src/core/`)

Stryker mutation testing measures whether unit tests actually detect logic changes, not just line coverage.

```bash
npm run test:mutation       # local (concurrency 4)
npm run test:mutation:ci    # CI-style (concurrency 2)
```

Configuration: `stryker.config.json`, `vitest.mutation.config.ts`. Scope is portable logic under `src/core/` with exclusions for session I/O, WASM loader glue, untested runners, and layout-only modules. Tests include co-located `src/core/**/*.test.ts` plus golden/parity suites. Stryker uses the Vitest runner only (no project-wide TypeScript checker, so `npm run typecheck:all` remains the compile gate).

| Threshold | Meaning |
|-----------|---------|
| `high` (60) | Target mutation score (covered modules) |
| `low` (50) | Warning band |
| `break` (48) | CI fails below this score (`STAB-CI-19`) |

Scope excludes session I/O, SAV loader WASM glue, analysis runners without tests, sankey layout, and other modules where mutants cannot be exercised meaningfully. Baseline (June 2026): ~46% covered score on the full `src/core/` tree; gated scope targets portable stats/semantic/harmonization logic.

HTML report: `reports/mutation/mutation-report.html` (gitignored). Incremental results cache locally in `reports/mutation/stryker-incremental.json` to speed repeat runs.

When changing `src/core/`, run mutation tests locally or rely on the CI `mutation` job (path-filtered to `src/core/**`).

### Known blind spots (stabilization)

`vitest.config.ts` still excludes some product areas without full characterization coverage: `src/components/charts/`, untested `src/store/slices/data/*` modules, `src/hooks/`, `duckDbArrow.ts` (browser path gated by Playwright smoke), and harmonization/onboarding UI below per-path floors. **STAB-CI-7 (July 2026)** removed blanket exclusions for `src/features/` and `src/components/overlays/` after 40+ co-located characterization tests landed. **STAB-CI-8** added `EngineProxy.test.ts` and `duckdbBundles.test.ts`. **STAB-CI-11** added per-path honesty thresholds. Green Vitest coverage does not imply workspace/export UI confidence — treat Playwright E2E as the product gate for excluded UI.

## 8. CI/CD Pipeline

GitHub Actions runs on every PR to `main`. `.github/workflows/test.yml` splits the former monolithic `test` job into **six required jobs** that run in parallel where possible (`STAB-CI-12`). Local parity: `npm run ci` (lint through build), `npm run ci:e2e` (product Playwright gates), or `npm run ci:full` (both). See `docs/playbooks/pre_pr_verification.md`.

### Merge gates summary

| Workflow | Job | Blocks merge? | Local mirror |
| :--- | :--- | :---: | :--- |
| `test.yml` | `lint-format` | Yes | `npm run ci:lint` |
| `test.yml` | `typecheck` | Yes | `npm run typecheck:all` |
| `test.yml` | `arch-guards` | Yes | worker-boundary + querybuilder-pure + design-tokens checks |
| `test.yml` | `unit-coverage` | Yes | `npm run test:run -- --coverage` + `npm run test:parity` |
| `test.yml` | `build` | Yes | `npm run build` |
| `test.yml` | `e2e` | Yes | `npm run ci:e2e` |
| `visual-e2e.yml` | `visual-e2e` | **No** (informational) | `npm run test:e2e:visual` |
| `mutation.yml` | `mutation` | Yes (path-filtered) | `npm run test:mutation:ci` |

All six `test.yml` jobs must pass. A green subset does **not** imply a mergeable PR.

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

1. **Playwright**: `npm run test:e2e` — 12 product specs; excludes `@visual` screenshot regression

### `visual-e2e` workflow (`.github/workflows/visual-e2e.yml`; STAB-CI-16)

Runs `npm run test:e2e:visual` (`@visual` tag only). **`continue-on-error: true`** — failures are informational until Linux baselines stabilize. Update snapshots locally with `npm run test:e2e:visual:update`.

### `mutation` workflow (path-filtered)

`.github/workflows/mutation.yml` runs when `src/core/**`, Stryker config, or lockfile change:

1. **Mutation testing**: `npm run test:mutation:ci` (Stryker + Vitest; 48% break threshold on gated `src/core/` scope)

Run locally when touching `src/core/**` even if the workflow is path-filtered.

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
