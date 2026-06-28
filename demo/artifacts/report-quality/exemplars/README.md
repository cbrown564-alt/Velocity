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

## 2. North-star exemplar on our fixture (still TODO)

The §4 north-star is a gold-standard brand-tracker deck **on one of our fixture datasets**, which
generated decks are diffed against. The external references above inform it but do not replace it.

- `brand_tracker_north_star_candidate.md` — Codex-generated candidate story frame and slide contract.
- `brand_tracker_north_star_signoff.md` — required human consultant sign-off checklist (not yet signed).

This folder intentionally distinguishes a Codex-generated candidate from a signed-off exemplar. The
candidate can be used to exercise `exemplar_diff.md`; it should not be used as external quality proof
until the sign-off checklist is complete.
