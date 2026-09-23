# Testing

Velocity has one automated GitHub check: `.github/workflows/test.yml` runs `npm run ci` on pushes to `main` and pull requests. The same command runs locally. It checks lint and formatting, all TypeScript projects, the worker/query/design boundaries, the full Vitest suite, and a production build. The workflow reports failures; it is not a product approval stage or a required branch status.

## Working on a change

Run a focused test while changing behavior. Add a test when a result, saved state, or contract changes. For a broad completion claim, run `npm run ci`. Run a browser journey with `npm run test:e2e` when the interaction, persistence, or export flow changes. Inspect changed screens and exported files directly.

Use a more specific check when the change calls for it:

| Need | Command |
| :--- | :--- |
| All Vitest tests | `npm run test:run` |
| Browser journeys | `npm run test:e2e` |
| Production browser smoke | `npm run test:e2e:production` |
| Node/WASM statistical parity | `npm run test:parity` |
| Coverage investigation | `npm run test:coverage` |
| Core mutation investigation | `npm run test:mutation` |
| Research-quality studies | Commands in `evals/research_quality/README.md` |

These specialist checks remain available without running on every change. A passing automated check verifies only the behavior it exercises. Product viability is decided through direct use by the product owner.

## Test placement

- Put portable analysis and export tests beside `src/core/` code.
- Test store and engine behavior at their public methods, including save and reopen when state is involved.
- Use `src/test/fixtures/variables.ts` for typed survey fixtures. Preserve categorical codes and labels in tests that cross ingestion, session, or export boundaries.
- Put browser journeys in `tests/e2e/*.spec.ts`. `tests/e2e/agentWorkflow.test.ts` is a Vitest engine test despite its directory name.
- Use `tests/parity/` for comparisons between Node and browser adapters.
- Golden results compare against committed expected files. A missing expected file fails the test.

`docs/playbooks/pre_pr_verification.md` gives the short local checklist. Historical CI designs and incident evidence remain in the archived audits; they do not define current branch requirements.
