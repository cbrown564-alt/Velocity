# Eval runners

Playwright-driven automation for benchmarks that need a live browser build. Frozen run evidence lives under `evals/eval-NN/runs/`.

## Commands (from repository root)

```bash
# Default output: evals/eval-05/runs/run-2026-03-13/artifacts
npm run eval:05

# Default output: evals/eval-06/runs/run-2026-03-13/artifacts
npm run eval:06

# Custom artifact directory
node scripts/eval/run-eval-05.mjs /path/to/artifacts
node scripts/eval/run-eval-06.mjs /path/to/artifacts
```

Set `VELOCITY_EVAL_BASE_URL` (default `http://127.0.0.1:4174/`) when not using the default preview port.

Start the app first, for example:

```bash
npm run build && npm run preview -- --port 4174
```
