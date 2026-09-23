# Local verification before a PR

Choose checks from the changed behavior. These are engineering checks, not product-stage approvals. The product owner decides when a research workflow is ready to share.

## During development

Run the narrowest relevant test while iterating. Inspect changed UI and exported files in the form people use them. `docs/arch_08_testing.md` owns the testing approach; the relevant playbook names any extra check for its area.

## Before claiming completion

| Change | Check |
| :--- | :--- |
| Any code change | `npm run ci` — lint, app typecheck, smoke tests, build |
| Browser journey | `npm run ci:full` — lint, all typechecks, full Vitest suite, build, Playwright |
| `src/core/` logic | Focused tests and `npm run test:mutation:ci` |
| Engine, worker, persistence, first-run, or upload journey | `npm run journey-gate` and `npm run test:e2e:production` when that journey is affected |
| Docs only | `npm run format:check` |

Report checks that were not run and why. A passing command verifies the behavior it covers; it does not establish that a researcher has validated the product.

## CI and setup

The GitHub workflows in `.github/workflows/` own their job definitions and branch requirements. Local `npm run ci` is a fast check, not an alias for every GitHub job. `npm run ci:full` includes browser journeys but does not include mutation or the separate production journey commands.

For a new clone, initialize `packages/readstat-wasm`, install dependencies with `npm ci --legacy-peer-deps`, and install Playwright browsers before E2E runs. The ESLint ratchet and E2E companion scripts use a merge base; set `ESLINT_RATCHET_BASE` or `E2E_COMPANION_BASE` to `origin/main` locally if needed.
