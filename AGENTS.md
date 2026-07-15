# Velocity

Stabilize the product before expanding it. The current priorities are truthful documentation, reliable workspace reopen, export quality, design-system enforcement, and CI that matches the stated quality bar.

## Read the owner

Start with `docs/README.md`. It routes work to the current tracker, strategy, feature matrix, architecture, design rules, eval framework, and playbooks. `docs/archive/` is historical evidence, not current direction.

Use the document for the part being changed:

- data and ingestion: `docs/arch_02_data_model.md`
- core and adapters: `docs/arch_03_headless_core.md`
- statistics: `docs/arch_04_statistical_engine.md`
- charts and rendering: `docs/arch_05_visualisation_engine.md`
- engine, MCP, sessions, workspaces, decks, and workers: `docs/arch_07_agent_architecture.md`
- tests and CI: `docs/arch_08_testing.md`
- UI and design tokens: `docs/design_01_system.md` and `docs/design_02_ux_modes.md`
- evals: `docs/eval_framework.md` and `evals/README.md`

Update an existing owner when behavior or a contract changes. Do not add a parallel plan, status report, or architecture summary.

## Invariants

- `src/core/` and `src/engine/` must not depend on React, the DOM, or browser APIs.
- Heavy computation runs in the worker.
- Preserve categorical codes and labels as dual state.
- Keep pure logic in `core/`, orchestration in `engine/`, and transport handlers thin.
- Engine results use `ResultEnvelope` so provenance remains inspectable.
- Version `VelocitySessionFile` changes and provide migrations; do not remove fields without one.
- Do not change statistical meaning, semantic confidence, or persistence behavior without focused tests and the relevant owner update.

Use the relevant procedure in `docs/playbooks/` rather than restating it here. Run focused tests and boundary checks while iterating. Use `npm run ci` before a broad completion claim and `npm run ci:full` when browser journeys are affected. Inspect changed UI and exported reports directly.
