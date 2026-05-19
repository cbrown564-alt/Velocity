# Test fixtures

Small binary and export artifacts used by unit/integration tests.

| Path | Used by |
| :--- | :--- |
| `export/sleep-report.pptx` | `src/engine/__tests__/agent-demo-pptx.test.ts` (normalized golden comparison; regenerate with `UPDATE_EXPORT_FIXTURES=1`) |

Survey `.sav` files live under `test_data/` at the repository root.
