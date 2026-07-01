## Purpose

Run the same gates CI runs **before opening or merging a PR**, so failures are caught locally instead of in follow-up fix PRs.

This playbook applies to **all** code changes — features, fixes, refactors, docs-with-scripts, and agent-generated PRs.

## Non-negotiable rule

A PR is not ready until **both** required workflow jobs would pass:

1. **`test` job** — lint, format, typecheck, architecture guards, Vitest+coverage, build
2. **`e2e` job** — full Playwright suite (required when touching UI, workspace, persistence, shortcuts, or onboarding)

Additionally, when `src/core/**` changes, the path-filtered **`mutation` workflow** must pass (`npm run test:mutation:ci`).

## Quick path (recommended)

```bash
# Mirrors .github/workflows/test.yml — test job
npm run ci

# Mirrors .github/workflows/test.yml — e2e job (install browsers once per machine/lockfile)
npx playwright install --with-deps
npm run ci:e2e
```

When `src/core/**` changed:

```bash
npm run test:mutation:ci
```

## Full command list (same order as CI)

### `test` job

```bash
npm run lint
npm run check:eslint-ratchet
npm run check:e2e-companion
npm run format:check
npm run typecheck:all
npm run check:worker-boundary
npm run check:querybuilder-pure
npm run check:design-tokens
npm run test:run -- --coverage
npm run build
```

### `e2e` job

```bash
npx playwright install --with-deps   # once per environment
npm run test:e2e
```

### `mutation` workflow (path-filtered in CI)

```bash
npm run test:mutation:ci
```

## Scoped shortcuts (only when the full suite is unnecessary)

Use **only** when the change is narrowly scoped **and** you will still run `npm run ci` before merge:

| Change type | Minimum local verification |
| :--- | :--- |
| Pure `src/core/` logic | `typecheck:all` + targeted tests + `test:mutation:ci` |
| Single component, no UI flow | `typecheck:all` + targeted `vitest run path/to/test` |
| Docs only (no scripts) | `format:check` |
| Docs + new/edited scripts | `format:check` + `typecheck:all` if TS |

**Never** treat `npm run typecheck` alone as sufficient — CI includes `typecheck:test` which type-checks test files under stricter fixture rules.

## UI / workspace change checklist

When changing any of the following, update E2E helpers or specs in the **same PR**:

- Keyboard shortcuts (`src/lib/keyboardShortcuts/`)
- Onboarding / spotlight tours
- Workspace banners or status strips
- Theme switcher labels or a11y names
- Modal open/close behavior tied to shortcuts

See `docs/playbooks/ui_mode_change.md` for mode-specific guidance.

## Test fixture discipline

- Use `makeVariable()` from `src/test/fixtures/variables.ts` or exported mocks — not inline partial objects
- Do **not** use `as never` / `as any` on `useVelocityStore.setState` to hide incomplete `Variable` shapes
- When adding fields to `AnalysisSettings` or `Variable`, update shared fixtures and any test that constructs those types

## Common local mistakes that fail CI

| Mistake | CI gate that catches it |
| :--- | :--- |
| Ran `npm run typecheck` but not `typecheck:all` | `typecheck:test` on test fixtures |
| Ran unit tests without `--coverage` | Coverage threshold in Vitest |
| Skipped Prettier | `format:check` (first step after lint) |
| UI change without E2E update | `check:e2e-companion` (test job) and parallel `e2e` job |
| Partial `{ id, type }` variable in tests | `typecheck:test` or runtime assertion mismatch |

## Definition of Done

- [ ] `npm run ci` passes locally
- [ ] `npm run ci:e2e` passes locally (when UI/workspace/persistence/shortcuts touched)
- [ ] `npm run test:mutation:ci` passes (when `src/core/**` touched)
- [ ] PR template checkboxes reflect commands actually run

## References

- CI workflows: `.github/workflows/test.yml`, `.github/workflows/mutation.yml`
- Testing architecture: `docs/arch_08_testing.md`
- RCA (July 2026): `docs/audit_08_ci_failure_rca_2026-07-01.md`
