# Report Quality Exemplars

The v2 plan (§4, §5) needs real reference material before generated decks are scored as "good."
There are two distinct things here — keep them separate:

## 1. External benchmark exemplars (real, now in repo)

Public references that anchor specific quality dimensions (§5). Provenance, licensing, and
per-dimension mapping are in `EXEMPLAR_SOURCES.md`.

- `pew_social_media_use_2025.pdf` — Pew Research Center, *Social Media Use in 2025* (full report).
  Anchors survey-data design craft, narrative structure, defensibility (transparent bases +
  methodology appendix), and tracker-style trended metrics.
- `kantar_brandz_2025_slides/` — five curated slides from Kantar BrandZ *Most Valuable Global
  Brands 2025*. Anchors the brand-tracker archetype story shape and design craft. The full 143 MB
  report is kept **local-only** (gitignored) at `docs/Kantar_BrandZ_2025_Most_Valuable_Global_Brands.pdf`.

## 2. North-star exemplar on our fixture (agent-built candidate)

The §4 north-star is a gold-standard brand-tracker deck **on one of our fixture datasets**, which
generated decks are diffed against. The external references above inform it but do not replace it.

- `brandtracker_w4_deck_candidate.md` — **agent-built candidate** (Phase C, PILOT-DEMO-3): metadata
  pointing to the generated PPTX `tests/fixtures/export/brandtracker-report.pptx`, built by
  `scripts/brand-tracker-demo.ts` (`npm run demo:brand-tracker`) on `public/examples/brandtracker_w4.sav`.
- `brandtracker_w4_conformance.md` — story-template (`08` §8) checklist + action-title rubric (`09`)
  scoring for the generated deck (agent-assessed narrative band 3, pending human confirmation).
- `brandtracker_w4_action_title_eval.json` — per-slide action-title eval record (rubric §7 schema).
- `brandtracker_w4_pptx_inspection.json` — `inspect-pptx.mjs` structural output (matches the
  `sleep-report.pptx` golden warning baseline).
- `brand_tracker_north_star_candidate.md` — earlier markdown-only story frame / slide contract
  (superseded as the diff target by the generated deck above; kept for provenance).
- `brand_tracker_north_star_signoff.md` — required human consultant sign-off checklist (not yet signed).

This folder intentionally distinguishes an agent-generated candidate from a signed-off exemplar. The
candidate can be used to exercise `exemplar_diff.md`; it should not be used as external quality proof
until the sign-off checklist is complete.
