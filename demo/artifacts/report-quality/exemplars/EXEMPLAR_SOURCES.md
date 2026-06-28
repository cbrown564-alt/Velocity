# External Exemplar Sources & Provenance

Real, externally-published references downloaded for the report-quality exemplar library
(plan §5, `docs/workstreams/deck_native/07_report_quality_experience_plan_v2.md`). Each anchors
a specific quality dimension so reviewers diff against a known bar instead of a home-grown one.

Retrieved: 2026-06-28.

| Local path | Source | Publisher | Retrieved from | Anchors (§5/§7) |
| :--- | :--- | :--- | :--- | :--- |
| `pew_social_media_use_2025.pdf` | Pew Research Center, *Social Media Use in 2025* (released 2025-11-20) | Pew Research Center | `pewresearch.org/wp-content/uploads/sites/20/2025/11/PI_2025.11.20_Social-Media-Use_REPORT.pdf` | Survey-data design craft, narrative structure, **defensibility** (transparent bases, methodology appendix), tracker-style trended metrics |
| `kantar_brandz_2025_slides/` (5 PNGs) | Kantar BrandZ — *Most Valuable Global Brands 2025* (20-year edition), curated slides | Kantar | Full PDF supplied by repo owner; see local-only note below | Brand-tracker **archetype** story shape, metric framing, design craft |

## Usage basis / licensing

- **Pew Research Center** content is freely distributed; Pew permits reuse with attribution
  (non-commercial reference use here). Committed in full (1.5 MB).
- **Kantar BrandZ** is freely published marketing collateral that Kantar distributes for wide
  sharing. We commit only **5 curated slide screenshots** as internal quality-reference fair use,
  **not** the full report. These are not redistributed as a product.

## Local-only: full Kantar report

The full Kantar BrandZ 2025 report (237 slides, 1920×1080, **~143 MB**) lives at
`docs/Kantar_BrandZ_2025_Most_Valuable_Global_Brands.pdf`. It is **gitignored** — it exceeds
GitHub's 100 MB file limit and would permanently bloat history. To work with the full deck,
keep that local copy (re-download from Kantar's gated BrandZ download page if missing).

## Curated Kantar slides (what each demonstrates)

- `01_cover.png` — title / brand-universe cover.
- `02_methodology_scale.png` — big-number methodology framing (data points, interviews, brands,
  categories, markets) → **defensibility / transparency** reference.
- `03_blueprint_framework_divider.png` — section divider establishing a framework → narrative
  structure reference.
- `04_indexed_chart_with_action_subtitles_and_source.png` — indexed line chart with action-style
  side headers and an on-exhibit source line → **best single craft+narrative+defensibility** slide.
- `05_insight_callout_action_subtitle.png` — "Kantar BrandZ Insight" callout with a conclusion
  sub-title → action-title / insight-framing reference.

## Caveat for the human sign-off

The 2025 edition is a **20-year anniversary / thought-leadership** issue. It is narrative-rich and
strong on design craft, but it leans editorial rather than being a pure current-wave brand-health
*tracker readout* (ranking table → YoY movement → category benchmark → drivers). Treat it as a
**design-craft and brand-storytelling** reference, not a 1:1 template for the tracker story spine in
`08_brand_tracker_story_template.md`. The §4 north-star-on-our-fixture-dataset (see
`brand_tracker_north_star_candidate.md` / `_signoff.md`) still needs a deck built on our own
fixture and a consultant sign-off — these external references inform it, they do not replace it.
