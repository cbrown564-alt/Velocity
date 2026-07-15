## Purpose

Run the same gates CI runs **before opening or merging a PR**, so failures are caught locally instead of in follow-up fix PRs.

This playbook applies to **all** code changes — features, fixes, refactors, docs-with-scripts, and agent-generated PRs.

## Non-negotiable rule

A PR is not ready until **all required workflow jobs** would pass:

| Workflow | Required jobs |
| :--- | :--- |
| `test.yml` | `lint-format`, `typecheck`, `arch-guards`, `unit-coverage`, `build`, `e2e`, `mutation` |
| `journey-gate.yml` | `journey-gate` |

The `visual-e2e` workflow is **informational only** — it does not block merge.

## Environment setup (once per clone)

```bash
git submodule update --init --recursive   # packages/readstat-wasm
npm ci --legacy-peer-deps
npx lefthook install                      # optional: pre-commit format + lint (STAB-CI-13)
npx playwright install --with-deps        # before first ci:e2e
```

**Ratchet merge base:** ESLint and E2E companion guards diff changed files against the PR merge base. CI sets `GITHUB_BASE_REF` and uses `fetch-depth: 0` on checkout. Locally, run from a branch with an upstream tracking ref, or override:

```bash
ESLINT_RATCHET_BASE=origin/main npm run check:eslint-ratchet
E2E_COMPANION_BASE=origin/main npm run check:e2e-companion
```

## Quick path (recommended)

```bash
# Full required gates (test.yml + e2e)
npm run ci:full
npm run journey-gate
npm run test:e2e:production

# Or stepwise:
npm run ci              # lint through build (all test.yml jobs except e2e)
npm run ci:e2e          # Playwright product gates (excludes @visual)
```

When `src/core/**` changed:

```bash
npm run test:mutation:ci
```

Fast lint/format feedback during development:

```bash
npm run ci:lint         # mirrors lint-format job only
```

## PR-type decision tree

```
Changed files?
├─ docs only (no scripts)     → format:check
├─ docs + scripts             → format:check + typecheck:all (if TS)
├─ src/core/** only           → typecheck:all + targeted vitest + test:mutation:ci
├─ UI trigger paths*          → ci:lint + ci:e2e (same PR must touch tests/e2e/)
├─ DuckDB Arrow / SAV WASM    → targeted playwright smoke + ci:full before merge
└─ default                    → npm run ci:full (+ test:mutation:ci if core touched)
```

\*Trigger paths: keyboard shortcuts, onboarding tours, workspace banners, theme switcher labels, Workshop Door landing — see `scripts/check-e2e-companion.mjs`.

## Full command list (same order as CI)

### `lint-format` job

```bash
npm run lint
npm run check:eslint-ratchet
npm run check:e2e-companion
npm run format:check
```

Shortcut: `npm run ci:lint`

### `typecheck` job

```bash
npm run typecheck:all
```

### `arch-guards` job

```bash
npm run check:worker-boundary
npm run check:querybuilder-pure
npm run check:design-tokens
```

### `unit-coverage` job

```bash
npm run test:run -- --coverage
npm run test:parity
```

### `build` job

```bash
npm run build
```

Combined locally: `npm run ci` runs lint-format → typecheck → arch-guards → unit-coverage → build in sequence.

### `e2e` job (boot prerequisite, then dependent product journeys)

```bash
npx playwright install --with-deps   # once per environment
npm run test:e2e                     # excludes @visual specs
```

Shortcut: `npm run ci:e2e`

If the `boot-prerequisite` Playwright project fails, fix that shared boundary first. The dependent `product` project is skipped by configuration; do not file the skipped journeys as feature regressions.

### `journey-gate` job

```bash
npm run journey-gate
npm run test:e2e:production
```

Both commands are required for engine, worker, persistence, first-run, upload, or journey-harness changes. The first command exercises the Vite diagnostic path and the second exercises the built application. Failure artifacts are written even when the journey exits early.

### `visual-e2e` workflow (informational)

```bash
npm run test:e2e:visual
```

### Stable `mutation` job (conditional Stryker step)

```bash
npm run test:mutation:ci
```

## Scoped shortcuts (only when the full suite is unnecessary)

Use **only** when the change is narrowly scoped **and** you will still run `npm run ci:full` before merge:

| Change type | Minimum local verification |
| :--- | :--- |
| Pure `src/core/` logic | `typecheck:all` + targeted tests + `test:mutation:ci` |
| Single component, no UI flow | `typecheck:all` + targeted `vitest run path/to/test` |
| DuckDB-WASM / SAV Arrow ingestion (`workerIngestion`, `insertArrowTable`) | `npx playwright test tests/e2e/duckdb-arrow-smoke.spec.ts` (+ `ci:full` before merge) |
| Docs only (no scripts) | `format:check` |
| Docs + new/edited scripts | `format:check` + `typecheck:all` if TS |

**Never** treat `npm run typecheck` alone as sufficient — CI includes `typecheck:test` which type-checks test files under stricter fixture rules.

## UI / workspace change checklist

When changing any of the following, update E2E helpers or specs in the **same PR**:

- Keyboard shortcuts (`src/lib/keyboardShortcuts/`)
- Onboarding / spotlight tours
- Workspace banners or status strips
- Theme switcher labels or a11y names
- Workshop Door / first-run landing CTAs

See `docs/playbooks/ui_mode_change.md` for mode-specific guidance.

## Test fixture discipline

- Use `makeVariable()` from `src/test/fixtures/variables.ts` or exported mocks — not inline partial objects
- Do **not** use `as never` / `as any` on `useVelocityStore.setState` to hide incomplete `Variable` shapes
- When adding fields to `AnalysisSettings` or `Variable`, update shared fixtures and any test that constructs those types

## Common local mistakes that fail CI

| Mistake | CI gate that catches it |
| :--- | :--- |
| Ran `npm run typecheck` but not `typecheck:all` | `typecheck` job (`typecheck:test` on test fixtures) |
| Ran unit tests without `--coverage` | `unit-coverage` job (global + per-path thresholds) |
| Skipped Prettier | `lint-format` job (`format:check`, step 4) |
| UI change without E2E update | `check:e2e-companion` (`lint-format` job) and `e2e` job |
| Partial `{ id, type }` variable in tests | `typecheck:test` or runtime assertion mismatch |
| Ran full Playwright including `@visual` and assumed merge gate | `e2e` job excludes `@visual`; visual specs are informational only |
| Forgot submodules before `npm ci` | WASM/readstat build failures in parity or e2e |

## Definition of Done

- [ ] `npm run ci:full` passes locally (or `npm run ci` + `npm run ci:e2e` separately)
- [ ] Engine/worker/persistence/first-run changes also pass `npm run journey-gate` and `npm run test:e2e:production`
- [ ] Every required GitHub job is complete and green on the current PR head before merge
- [ ] `npm run test:mutation:ci` passes (when `src/core/**` touched)
- [ ] PR template checkboxes reflect commands actually run

## References

- CI workflows: `.github/workflows/test.yml`, `.github/workflows/visual-e2e.yml`, `.github/workflows/mutation.yml`
- Testing architecture: `docs/arch_08_testing.md`
- RCA (July 2026): `docs/audit_08_ci_failure_rca_2026-07-01.md`
