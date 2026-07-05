# Eval 07 Brief Reference

- Source brief: [evals/eval-07/brief.md](../../brief.md)
- Run commit: `0950ba084fdef8e0300dcc9f334c352a5ceda09c` (Phase C tip; frozen as part of the Phase D integration branch `cursor/brand-tracker-demo-phase-d-1f00`)
- Notes: This run executed the pilot-archetype brand tracker end to end against the real `VelocityEngine` Node runtime: the transformation recipe (`npm run demo:brand-tracker-recipe`), the Wave 4 story-template deck (`npm run demo:brand-tracker`), and the Wave 5 refresh (`npm run demo:brand-tracker-wave-refresh`), with engine ground-truth parity enforced by `tests/golden/brand_tracker_parity.test.ts`. No new engine surface was introduced.
