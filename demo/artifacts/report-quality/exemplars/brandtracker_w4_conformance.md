# Brand Tracker Wave 4 Deck — Conformance & Action-Title Scoring

Candidate deck: `tests/fixtures/export/brandtracker-report.pptx`
(built by `scripts/brand-tracker-demo.ts`).
Scored by the building agent against the story-template conformance checklist
(`08_brand_tracker_story_template.md` §8) and the action-title rubric
(`09_action_title_eval_rubric.md`). **Agent scoring is the candidate signal;
human sign-off (`brand_tracker_north_star_signoff.md`) remains the promotion bar.**

## 1. Story-template conformance checklist (`08` §8)

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Opens with an SCR executive summary carrying 3–4 supporting takeaways | ✅ | Slide 2 title = SCR verdict; speaker notes carry Situation/Complication/Resolution + 4 section takeaways |
| Sections appear in canonical order; flat sections demoted | ✅ | Sections 0–8 in order; the flat "worth the price" mover is kept as the honesty slide, not promoted to a headline |
| Every body slide has a takeaway (action) title with direction + magnitude | ✅ | Slides 2–15 all state a conclusion; magnitudes on §2.2 below |
| Headline health slide compares vs. prior wave **and** vs. category | ✅ | Slide 3 subtitle: "vs 67% in W3; +5.9pts, significant"; notes add composite index +4pts; category standing on slides 8–9 |
| Funnel slide highlights the biggest significant mover | ✅ | Slide 5 "the gain is at the top" — unaided +5.7pts is the largest significant funnel mover |
| Drivers section explains the headline without smuggling recommendations | ✅ | Slides 10–12 are evidence-only; imperatives live on slide 15 |
| Segment slides appear only where a segment diverges significantly | ✅ | Slides 13–14 show the only significant divergences (Growth +13.4pts; under-35s +8.9pts); Core/Value/older auto-omitted |
| Recommendations separated from evidence, each tied to an earlier finding | ✅ | Slide 15 ties to funnel (flat conversion) + segment (Growth/under-35) findings |
| Every body number reproducible from appendix + recipe | ✅ | Appendix slides 16–18 carry bases, weighting, significance, and the numbered recipe; all magnitudes trace to `brand_tracker_ground_truth.json` |
| No "confident but indefensible" titles | ✅ | Non-significant movers ("worth the price" −1.9pts, usage +2.4pts, conversion +2.0pts) titled "broadly stable"/"held flat"; NPS flagged low-base |

**Checklist result: 10/10 pass.**

## 2. Action-title rubric (`09`)

### 2.1 Gates (hard) across body slides

- **G1 · Supported:** 0 failures. Each title's number appears on-slide (chart/table)
  or in the on-slide subtitle base-note; wave-over-wave magnitude and "first time
  in four waves" history trace to `deltas.w3_w4` / `storyline_checks` and are stated
  in subtitles/notes + appendix (the rubric permits history sourced from the recipe).
- **G2 · Defensible:** 0 failures. Significance claimed only where `significant_95 = true`;
  causation hedged ("likely fuelling"); within-margin movers labelled "broadly stable".

### 2.2 Per-title bands (body slides + exec takeaways)

| Slide | Role | Planted number (ground truth) | Sig? | Band |
| :--- | :--- | :--- | :--- | :--- |
| 2 | finding (SCR) | verdict: health up, top-of-funnel, Beacon>Meridian | — | Strong |
| 3 | finding | aided +5.9pts → 72.7% (z=2.96, p=0.003) | yes | Strong |
| 4 | finding | consider T2B(total) +4.5pts → 37.7% (p=0.029) | yes | Strong |
| 5 | finding | unaided +5.7pts → 36.5% (p=0.005) | yes | Strong |
| 6 | comparison | conversion +2.0pts → 53.1% (p=0.44) | no | Strong |
| 7 | finding | usage +2.4pts → 14.9% (p=0.10) | no | Strong |
| 8 | comparison | Beacon 41.7% > Meridian 38.5% (first in 4 waves) | fact | Strong |
| 9 | comparison | pref: Meridian 24.9 / Beacon 24.8 / Atlas 19.5 | — | Strong |
| 10 | finding | 'innovative' +6.7pts → 37.0% (p=0.007) | yes | Strong |
| 11 | finding | 'worth the price' −1.9pts → 35.3% (p=0.46) | no | Strong |
| 12 | finding | ad recall +7.4pts → 26.4% (p<0.001) | yes | Strong |
| 13 | comparison | Growth unaided +13.4pts → 46.2% (p<0.001) | yes | Strong |
| 14 | comparison | 18–34 unaided +8.9pts → 42.0% (p=0.006) | yes | Strong |
| 15 | recommendation | ties to slides 5–7, 13–14 | — | Strong |

Appendix/context slides (1, 16–18) scored on the reduced set (`09` §5): G1 only.
All pass — bases, waves, and the NPS low-base caveat are stated as conclusions,
not topics.

### 2.3 Deck-level rollup (`09` §4)

| Metric | Value | Narrative 2 floor | Narrative 3 target |
| :--- | :--- | :--- | :--- |
| Gate failures (G1/G2) on body slides | 0 | 0 (met) | 0 (met) |
| Body slides Good or Strong | 14/14 (100%) | ≥90% (met) | ≥95% (met) |
| Body slides Strong | 14/14 (100%) | ≥40% (met) | ≥70% (met) |
| Exec-summary takeaways | all Strong | all Good/Strong (met) | all Strong (met) |
| Rejects on body slides | 0 | blocks (none) | blocks (none) |

**Agent-assessed narrative band: 3 ("works well").** Pending human confirmation of
the judgement criteria (G1/G2/C1/C3), per `09` §6 and the sign-off checklist.

## 3. Structural inspection (`scripts/report-quality/inspect-pptx.mjs`)

Full output: `brandtracker_w4_pptx_inspection.json`.

- 28 physical slides (deck title + 9 section dividers + 18 content), 28 speaker-note slides.
- 18 exhibit tables; 1 typeface (≤2 ✅); 0 unresolved placeholder tokens; 0 empty slides.
- **Warnings match the committed `sleep-report.pptx` golden baseline exactly**
  (`status: needs_review`; "Potential text overflow detected." and "Palette has more
  than four detected colors."). These are pre-existing characteristics of the node PPTX
  exporter (title-box height heuristic and the 6-colour significance/branding palette),
  not regressions introduced by this deck. Accepted as documented build warnings.

## 4. Known limitations for human review

- Wave-over-wave trend is carried in titles/subtitles/notes rather than on-chart:
  exhibits are computed on the single loaded wave (W4). The comparator + significance
  verdict appear in each slide's on-slide subtitle and are reproducible from the
  appendix recipe (satisfies rubric G1). A true multi-wave trend exhibit is Phase D work.
- The node exporter renders exhibits as data tables (chartCount 0), identical to the
  sleep golden. Native chart rendering is out of scope for Phase C (no new chart types).
