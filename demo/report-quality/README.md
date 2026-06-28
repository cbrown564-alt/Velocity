# Report Quality Fixtures

This folder is the local evidence scaffold for the deck-native report-quality plan.

## Fixtures

- `fixtures/brand_tracker_wave_1.csv` and `fixtures/brand_tracker_wave_2.csv`: tiny synthetic brand/category tracker waves for recurring-report and wave-refresh checks.
- `fixtures/concept_test.csv`: tiny synthetic concept-test fixture for decisive pass/fail story checks.
- `fixtures/report_quality_fixtures.json`: machine-readable fixture and expected-job registry.

These files are intentionally small and synthetic. They are for deterministic harness development, not market claims.

## Review Artifacts

Use the PPTX inspection and visual-review harness on any generated deck:

```bash
node scripts/report-quality/inspect-pptx.mjs tests/fixtures/export/sleep-report.pptx
node scripts/report-quality/review-artifact.mjs tests/fixtures/export/sleep-report.pptx --out-dir demo/artifacts/report-quality/latest
```

## Exemplar Gate

The north-star exemplar lives under `demo/artifacts/report-quality/exemplars/`. A Codex-generated candidate can unblock diff tooling, but the plan's promotion bar still requires human consultant sign-off before using the exemplar as a quality claim.
