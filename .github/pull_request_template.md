## Summary
- What problem does this PR solve?
- What is intentionally out of scope?

## Change Type
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor (no behavior change)
- [ ] Docs-only
- [ ] Test-only

## Scope + Required Docs Read
List docs read based on touched areas (per `AGENTS.md`):
- [ ] `docs/arch_01_system_architecture.md` (new feature / major refactor)
- [ ] `docs/arch_02_data_model.md` (data structures / ingestion / types)
- [ ] `docs/arch_03_headless_core.md` (`src/core/*` or `adapters/*`)
- [ ] `docs/arch_04_statistical_engine.md` (stats, weights, significance)
- [ ] `docs/arch_05_visualisation_engine.md` (charts / D3 / canvas)
- [ ] `docs/arch_08_testing.md` (CI gates, test strategy, pre-PR verification)
- [ ] `docs/roadmap_00_strategic_guide.md`
- [ ] `docs/blue_02_feature_matrix.md`
- [ ] `docs/design_01_system.md` (React UI / CSS / theme tokens)
- [ ] `docs/design_02_ux_modes.md` (mode separation)

## Architectural Invariants (required)
- [ ] `src/core/*` has no React/DOM/browser API dependencies.
- [ ] Heavy compute stays in Worker (not main thread).
- [ ] Dual-state data model preserved (raw codes + labels).
- [ ] Dependency direction preserved across core/adapters/UI seams.

## Contracts Changed
Describe interface/schema/type contract deltas.
- Public interfaces changed: [ ] Yes [ ] No
- Data/schema changed: [ ] Yes [ ] No
- If yes, list exact contracts and migration impact:

## Test Plan
Commands run and outcomes. **Both CI jobs must be green** (`test` + `e2e` when UI/workspace touched). See `docs/playbooks/pre_pr_verification.md`.

```bash
# Minimum: mirrors test job
npm run ci

# When UI/workspace/persistence/shortcuts/onboarding changed:
npm run ci:e2e

# When src/core/** changed:
npm run test:mutation:ci
```

Results:
- [ ] `npm run ci` passed (lint, format, typecheck:all, guards, coverage, build)
- [ ] `npm run ci:e2e` passed (if UI/workspace/persistence/shortcuts/onboarding touched)
- [ ] `npm run test:mutation:ci` passed (if `src/core/**` changed)
- [ ] Manual verification completed (if applicable)

## Risks + Mitigations
- Known risks:
- Mitigations / follow-up:

## Performance / Threading Notes
- Any heavy processing introduced or moved?
- Evidence that main thread remains render/state only:

### Performance Change (required if this PR claims or risks a perf change)
- [ ] No performance-relevant change (skip the rest of this section).
- **Hypothesis:** what should get faster/lighter, and why?
- **Measurement:** how was it measured? (e.g. `npm run benchmark:perf`,
  `benchmark:sav`, `benchmark:crosstab`, `test:e2e:production`, browser trace)
- **Before/after evidence:** paste the relevant numbers (initial bytes, worker
  ready, upload→ready, first crosstab, export modal open, or benchmark deltas).

| Metric | Before | After |
| :--- | ---: | ---: |
|  |  |  |

- [ ] First-load byte budget still passes (`npm run test:e2e:production`).
- [ ] `*_latest.json` benchmark artifacts regenerated if this PR moves the baseline (see `validation/README.md`).

## Docs-to-Code Sync
- [ ] No contract/invariant changed, so no docs update needed.
- [ ] Contract/invariant changed and docs were updated in this PR.
- Docs updated:

## Reviewer Checklist Seed
Checked in this PR to speed reviewer pass:
- [ ] Dual-state model behavior validated
- [ ] Portable logic remains in `src/core/*`
- [ ] Stats invariants validated (if touched)
- [ ] UX modes/theme token rules respected (if touched)

## Rollback Plan (for risky changes)
If rollback is needed, what is the safest immediate action?
