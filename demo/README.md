# Agent-Driven Demo Scaffold

This folder defines a repeatable demo capture flow for Velocity.

## What is here

- `contracts/first-analysis.json`: machine-readable quick "aha" flow contract.
- `contracts/deck-export-complete.json`: machine-readable full export proof contract (asserts real `.pptx` download).
- `contracts/brand-tracker-load.json`: load the primary Load Example (brand tracker Wave 4) and confirm the funnel-relevant first crosstab.
- `contracts/brand-tracker-recipe.json`: raw-wave to analysis-ready recipe (references the engine recipe script `npm run demo:brand-tracker-recipe`).
- `contracts/brand-tracker-deck-export.json`: brand tracker deck export proof (asserts real `.pptx` download).
- `contracts/brand-tracker-wave-refresh.json`: next-quarter Wave 5 refresh (references the engine script `npm run demo:brand-tracker-wave-refresh`).
- `scripts/run-demo-flow.mjs`: Playwright-based runner to execute a contract.
- `qa/checklist.md`: human QA checklist before publishing.
- `report-quality/`: synthetic report-quality fixtures, story checklist, and exemplar gate.
- `artifacts/`: run outputs (created at runtime).

## Run it

1. Start the app locally (or ensure an existing Playwright web server target is running).
2. Execute:

```bash
npm run demo:run:first-analysis
npm run demo:run:deck-export-complete
```

Optional flags:

```bash
node demo/scripts/run-demo-flow.mjs --contract demo/contracts/first-analysis.json --base-url http://127.0.0.1:4173 --headed
```

Runner supports actions:

- `goto`
- `upload`
- `click`
- `clickRole`
- `clickIfVisible`
- `clickAndWaitForDownload` (use `expectedExtension`, optional `downloadFilename`)
- `type`
- `waitForTimeout`

Assertion types:

- `visible`, `attached`, `visibleAny`, `stable` (waits for full opacity before capture)

## Artifact contract

Each run writes:

- `demo/artifacts/<flow>/latest/steps.json`: step log, duration, pass/fail, download metadata.
- `demo/artifacts/<flow>/latest/steps.json` also includes a `quality` block when the contract defines timing or recoverability targets.
- `demo/artifacts/<flow>/latest/screens/*.png`: step screenshots where `capture=true`.
- `demo/artifacts/<flow>/latest/downloads/*`: saved export files for proof flows.

Report-quality PPTX review:

```bash
npm run report-quality:inspect -- tests/fixtures/export/sleep-report.pptx
npm run report-quality:review -- tests/fixtures/export/sleep-report.pptx --out-dir demo/artifacts/report-quality/latest
```

Capture quality defaults:

- `reducedMotion: reduce` in browser context
- per-step `settleMs` delay before screenshots
- `animations: disabled` on screenshot capture

## Extension model

- Duplicate the contract file for each persona or workflow.
- Keep selectors stable with `data-testid` where possible.
- Add strict post-action assertions for every meaningful step.
