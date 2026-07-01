# CI Failure Root Cause Analysis

Date: 2026-07-01  
Scope: Repeated CI failures on `main` (June 15 – July 1, 2026)  
Method: Git history analysis, GitHub Actions run inspection, testing-strategy audit, process/doc gap audit

## Executive Summary

**The failures are not a testing-strategy quantity problem.** They are overwhelmingly **deterministic process failures**: contributors and agents validated a subset of CI locally while documentation still described a weaker gate set. The dominant failure modes were Prettier (`format:check`), incomplete test fixtures under `typecheck:test`, and E2E specs not updated after UI/shortcut/onboarding changes.

**Verdict:** Test **better at the right layer**, not fewer tests. Keep core golden/parity/mutation investment. Fix the **local ↔ CI parity gap** and **fixture discipline** so existing tests provide the confidence they are meant to.

## Failure Timeline (June 15 – July 1)

| Date | PR / commit | Failed gate | Root cause |
| :--- | :--- | :--- | :--- |
| Jun 27 | PR #5 | E2E + coverage | ThemeSwitcher a11y label change broke locator; new engine methods dropped function coverage below threshold |
| Jul 1 | PR #6 | Prettier + unit | Unformatted files; session snapshot expectations stale after label enrichment |
| Jul 1 | PR #7 | Prettier + E2E + typecheck | Onboarding tour overlay blocked E2E; test fixtures missing new `AnalysisSettings` fields |
| Jul 1 | PR #8 | Prettier + E2E | `WorkspaceStatusStrip` changed pilot-workflow selectors |
| Jul 1 | PR #10 → #13 | typecheck + E2E + unit | **Cascade:** partial `{ id, type }` fixtures; shortcut registry broke `D` to close Variable Manager; variable id mismatch in weight test |
| Jul 1 | PR #14 | Prettier | New script not formatted |

Latest main (`48783df`) is green. No evidence of flaky infrastructure — same commits failed consistently until fixed.

## Failure Category Breakdown

| Gate | Count | Flaky? | Notes |
| :--- | ---: | :--- | :--- |
| Prettier / `format:check` | 6 | No | Most common; no pre-push enforcement |
| `typecheck:all` / `typecheck:test` | 4 | No | Partial fixtures vs strict `Variable` / settings types |
| Unit tests (Vitest) | 4 | No | Fixture drift, id mismatches, snapshot expectations |
| E2E (Playwright) | 5 | No | UI/shortcut/onboarding changes without spec updates |
| Coverage threshold | 1 | No | New untested functions (PR #5) |
| Lint, build, guards, mutation | 0 | — | Never failed in window |

## Root Cause Themes

### 1. Local validation ≠ CI (primary)

PR #10 explicitly ran `typecheck`, `lint`, `format:check`, and **targeted** unit tests — but CI runs `typecheck:all` (includes `tsconfig.test.json`) and a **parallel E2E job**. Passing `npm run typecheck` does not substitute for `typecheck:test`.

### 2. Documentation drift reopened after STAB-CI-1

`docs/arch_08_testing.md` still claimed "No ESLint gate" while `.github/workflows/test.yml` runs `lint` and `format:check`. Playbooks (`add_tests_first.md`) define Done as "tests pass" with no CI command list. PR template omits format, build, guards, E2E, and mutation.

### 3. Tests written for speed, not contract fidelity

Anti-patterns found in recent UI work:

- `useVelocityStore.setState({...} as never)` bypassing incomplete `Variable` shapes
- Inline `{ id, type }` objects where `Variable[]` is required
- Component tests in **coverage-excluded** dirs (`src/features/`, overlays) — green coverage does not reflect product surface

Good counter-example: `commandPaletteSearch.test.ts` (pure function, shared fixtures, behavior-focused).

### 4. UI changes without E2E companion updates

Repeated pattern when touching shortcuts, onboarding, banners, or theme labels:

| UI change | Broken spec |
| :--- | :--- |
| STAB-UI-T6 shortcut registry | `tests/e2e/opfs.spec.ts` |
| `WorkspaceStatusStrip` | `tests/e2e/pilot-workflow.spec.ts` |
| ThemeSwitcher a11y rename | `visual-polish-theme-table.spec.ts` |
| Onboarding spotlight tour | Multiple E2E helpers |

### 5. Coverage metrics can mislead (but are not the main failure driver)

`vitest.config.ts` excludes large product areas by design (`STAB-CI-1` honest ratchet). E2E is the product gate for excluded paths. Only one failure in this window was coverage-threshold related.

## Answers to Stated Questions

| Question | Answer |
| :--- | :--- |
| Failure in testing strategy? | **Partially.** Strategy is sound for `src/core/`; UI layer adds tests that don't always pin contracts or update E2E companions. |
| Lack of documented processes? | **Yes — primary driver.** No single pre-PR command list; playbooks under-specify CI; doc drift on lint/format. |
| Fewer tests or test better? | **Test better + run the right gates.** Do not reduce core golden/parity/mutation. Reduce low-value structural assertions; standardize typed fixtures. |
| Coverage theater? | **Mixed.** Core tests derive real value. UI component tests often run outside the coverage gate and use type bypasses — they catch some regressions but can miss contract drift that `typecheck:test` catches. |

## Corrective Actions (this PR and follow-ups)

### Implemented in `cursor/ci-root-cause-fixes-b783`

1. **`npm run ci`** — mirrors the `test` workflow job locally
2. **`npm run ci:e2e`** — Playwright gate (documented separately; browsers required)
3. **`docs/playbooks/pre_pr_verification.md`** — canonical pre-PR command list
4. Sync **`arch_08_testing.md`**, **`add_tests_first.md`**, PR template, **`AGENTS.md`**, **`dev_01_contributing.md`**
5. **`makeVariable()` factory** in `src/test/fixtures/variables.ts` for typed test data
6. Tracker row **`STAB-CI-2`** for ongoing CI truth maintenance

### Recommended follow-ups (STAB-CI-3+)

| ID | Action | Rationale |
| :--- | :--- | :--- |
| STAB-CI-3 | ESLint warn → error ratchet on touched files | Lint passes today with warnings only |
| STAB-CI-4 | UI playbook: require E2E update when changing shortcuts/onboarding/banners | Repeated failure pattern |
| STAB-CI-5 | Replace `describe.skip` on `duckDbArrow.test.ts` with browser smoke | Critical WASM path untested |
| STAB-CI-6 | Shrink coverage exclusions as characterization tests land | Honest green for product code |

## References

- `docs/arch_08_testing.md` — testing architecture
- `docs/playbooks/pre_pr_verification.md` — pre-PR gate (new)
- `docs/archive/2026-05/audits/audit_04_test_ci_health_2026-05-19.md` — prior audit (partially superseded)
- `.github/workflows/test.yml` — CI source of truth
