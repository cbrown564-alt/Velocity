# Test And CI Health Review

Date: 2026-05-19

Scope: project health, package scripts, test organization, TypeScript configuration, build tooling, coverage thresholds, CI readiness, and dependency risk. Read-only audit; no files modified.

## Summary Judgment

Velocity has solid CI foundations: typecheck scripts, architecture boundary scripts, Vitest with 80% thresholds, Playwright E2E, and a mature test pyramid on paper. The main risks are documentation/tooling drift, weak TypeScript strictness, heavy coverage exclusions, a missing production build in CI, dependency fragility, and OPFS E2E reliability.

The project is past “hobby test setup.” It needs CI truthfulness and stricter gates before it can be treated as mature.

## Strengths

### Useful Script Stack

`package.json` exposes a meaningful gate stack:

- `typecheck`
- `typecheck:test`
- `typecheck:all`
- `check:worker-boundary`
- `check:querybuilder-pure`
- `test:coverage`
- `test:parity`
- Playwright E2E scripts
- SAV benchmark scripts

This shows intentional architecture enforcement, not just unit testing.

### Substantive CI Foundation

The GitHub workflow runs on `main` pull requests and pushes with:

- `npm ci --legacy-peer-deps`
- Typecheck
- Worker-boundary and query-builder purity scripts
- Vitest with coverage and artifact upload
- Playwright with retries in CI

### Test Organization Matches The Intended Pyramid

Vitest includes:

- `src/**/*.test.{ts,tsx}`
- `tests/**/*.test.{ts,tsx}`
- `mcp-server/**/*.test.{ts,tsx}`

The suite includes:

- Unit tests in `src/services` and `src/core`
- Component tests in `src/components` and `src/features`
- Integration tests in `src/test/integration`
- Golden/parity tests in `tests/golden` and `tests/parity`
- Agent workflow tests
- Browser E2E specs

### Golden And Parity Investment

The repo has fixture-backed golden tests, R parity checks, SPSS parity tests, and adapter parity tests. This is essential for a statistical product.

### Some Earlier P0/P1 Issues Are Addressed

- Persistence now uses `getSafeLocalStorage` rather than raw global storage binding.
- Merge orchestration uses `dataset?.variables`, not the old nonexistent `state.variables`.
- Request IDs are present in `EngineProxy` and the engine worker protocol.

### Modern Build Tooling

The project uses Vite 6, React 19, manual chunks for major vendors, path aliases, and ES module workers.

## Concrete Risks

### Documentation Versus Reality Drift

| Claim | Reality |
|---|---|
| COOP/COEP “pre-configured” | Not visible in `vite.config.ts`; if handled elsewhere, docs should point there. |
| ESLint and Prettier documented | No clear ESLint/Prettier config or lint script is present. |
| Lint in CI | CI does not appear to run lint, and `package.json` has no lint script. |
| Vanilla CSS only | Current policy and code use Tailwind as a first-class styling layer. |
| React 18 references | `package.json` uses React 19. |
| 51 failing tests in older docs | Current code and local run indicate tests now pass. |

Stale docs mislead contributors and agents, and are now a planning risk.

### Weak TypeScript Strictness

`tsconfig.json` has no `strict`, uses `allowJs: true`, and has `skipLibCheck: true`. `mcp-server/tsconfig.json` is stricter than the main app. Green `tsc` is helpful, but it is not yet a strong correctness gate.

### Production Build Missing In CI

The production build is not an explicit CI gate. This matters because Vite/Rollup/readstat/worker bundling failures can pass tests but break deployment.

### Coverage Gate Is Narrower Than It Looks

`vitest.config.ts` uses `coverage.all: false` and excludes large areas:

- `src/features/`
- `src/hooks/`
- `src/store/slices/`
- `src/components/overlays/`
- `src/components/charts/`
- selected export and proxy paths

The 80% threshold therefore applies to a narrowed surface, not the whole application.

### E2E And OPFS Reliability

OPFS browser flows are conditional and historically flaky. Since persistence/workspace durability is one of the product’s hardest claims, this needs a deterministic smoke path.

### Dependency And Install Risk

- CI requires `npm ci --legacy-peer-deps`, signaling peer dependency debt.
- `@duckdb/duckdb-wasm` is pinned to a dev/pre-release build.
- `@duckdb/node-api` is in production dependencies despite being Node-specific.
- No root `engines` field documents the Node requirement.
- Dependency update automation is not apparent.

### Test Gaps For Critical Paths

- `src/services/duckDbArrow.test.ts` is skipped.
- WVS R parity tests remain `todo`.
- `test:parity` exists as a script and should remain a named gate.
- Browser E2E coverage is thin relative to workspace/persistence risk.

## Prioritized Quality-Gate Recommendations

### P0: CI Truthfulness

1. Add `npm run build` to CI.
2. Reconcile COOP/COEP docs with actual Vite/dev-server behavior.
3. Update docs to reflect actual React version, Tailwind policy, test status, and real CI gates.

### P1: Type Safety And Lint

1. Turn on strict TypeScript incrementally, starting with `src/core` and `src/engine`.
2. Add ESLint or remove lint claims from docs and PR templates.
3. Add `npm run lint` once lint config exists, then wire it into CI.

### P2: Test And Coverage Rigor

1. Keep `npm run test:parity` as a named CI step.
2. Tighten coverage over time by removing exclusions for store slices and feature code.
3. Move toward `coverage.all: true` with per-directory thresholds.
4. Stabilize or explicitly quarantine flaky OPFS E2E tests.
5. Resolve the skipped DuckDB Arrow path with a browser smoke test or dedicated test project.

### P3: Dependencies And Supply Chain

1. Move `@duckdb/node-api` to `devDependencies` or optional peer if not shipped to the browser.
2. Add `"engines": { "node": ">=20" }`.
3. Document why `--legacy-peer-deps` is required and plan a peer dependency fix.
4. Add Dependabot or Renovate for npm and GitHub Actions.
5. Add an audit/OSV step with an initial allowed-failure period.

### P4: Operational Maturity

1. Add release/checklist docs covering submodules, builds, parity tests, and browser smoke tests.
2. Turn benchmark scripts into documented regression thresholds or optional scheduled jobs.

## Maturity Snapshot

| Area | Maturity | Notes |
|---|---|---|
| Unit/integration tests | Strong | Broad coverage, golden/parity, custom architecture scripts. |
| E2E | Moderate | Playwright and agent workflow gates exist; OPFS remains fragile. |
| TypeScript | Weak to moderate | Split configs, no strict mode for the main app. |
| Lint/format | Missing | Documented but not implemented. |
| CI | Good base | Missing production build, lint, audit, and possibly named parity step. |
| Coverage enforcement | Moderate but narrow | 80% threshold on an excluded subset. |
| Docs accuracy | Weak | Several contradictions with repository reality. |
| Dependencies | Moderate risk | Pre-release DuckDB, legacy peer deps, Node API placement. |

## Bottom Line

Velocity’s test and CI foundation is real, but the release bar is not yet trustworthy enough for a mature product. The next move is not more tests indiscriminately; it is making the documented gates match the actual gates, adding production build/lint/strictness incrementally, and making persistence/workspace E2E reliable.
