# Public Survey Data Catalog for Velocity

This is a seed catalog for the research-quality workstream. Verify the exact licence/terms of every downloaded release before use. The goal is to separate **good evaluation material** from **material safe for model training/commercial prototypes**.

| Source | What is available | Why useful | Initial role | Rights caution |
|---|---|---|---|---|
| Pew Research Center / American Trends Panel | Wave datasets, questionnaires, toplines, methods and reports; many files in SPSS | Rich documentation and expert publications; recent waves include media/brand grids | Eval + possibly training after wave-specific terms review | ATP data have separate terms; do not assume general Pew terms govern every wave |
| ANES | Time-series and pilot data in SPSS/CSV/Stata plus questionnaires/codebooks | Repeated waves, complex documentation, realistic analysis questions | Eval, analysis planning, trend tests | Check release terms and attribution |
| General Social Survey | SPSS/Stata downloads, explorer and long time series | Variable discovery, trends, weights, missingness | Eval + training candidate subject to terms | Verify redistribution/training terms |
| European Social Survey | Cross-national repeated rounds, detailed docs | Weighting, cross-country analysis, repeated measures | Non-commercial research/eval | CC BY-NC-SA 4.0: non-commercial restriction |
| UK Data Service | British Social Attitudes, Understanding Society, government/academic surveys | UK-relevant, documentation-rich, varied designs | Eval; some training candidates | Licence and commercial-use rights vary by study |
| World Values Survey | SPSS/Stata/SAS/R files across waves | Cross-national/time-series stress tests | Research/eval only by default | Public terms restrict to non-profit use and redistribution |
| LongDA benchmark | 505 expert-grounded questions over 17 U.S. national surveys | Strong benchmark design precedent and external test | External benchmark / harness inspiration | Respect benchmark and underlying dataset terms |
| BRAND database | 2020/2024 brand familiarity, liking and recognition for 500+ brands | Closest open brand-tracking proxy located | Brand semantics / trend proxy | Verify download licence before training |
| FSA Consumer Insights Tracker | Monthly tracker outputs and open tables | Real tracker structure and trend reporting | Tracker/report reconstruction | Microdata availability differs from published tables |
| Kaggle customer/brand survey datasets | Numerous small customer satisfaction/brand-preference datasets | Edge cases, quick ingestion tests | Low-trust proxy only | Provenance/licence inconsistent; require data card |

## Suggested first public projects

### P01 — Pew media brands

Use a recent American Trends Panel wave containing a matrix of media brands and trust/distrust. Treat it as a brand-like grid: awareness/familiarity is not identical to a commercial tracker, but the structure is close enough to exercise grids, subgroup analysis, weighting, story selection and deck generation.

Reference assets: questionnaire, methodology, toplines and Pew's published article/report. Derive tasks from the publication, but keep the exact reference findings hidden from systems under evaluation.

### P02 — ANES repeated-wave analysis

Select a compact family of repeated questions. Test variable mapping across releases, weighting, subgroup breaks, trend language and changed wording. This is useful for tracker-replay mechanics even though the domain is not commercial brands.

### P03 — GSS trend report reconstruction

Choose a small topic with stable variables and published trend commentary. Evaluate brief-to-analysis planning, trend detection and restrained language.

### P04 — ESS cross-country study

Use for weighting, country breaks, low-base safeguards and cross-national visualisation. Keep in non-commercial research/evaluation unless licensing permits broader use.

### P05 — BRAND 2020 -> 2024

If licensing permits, construct a two-wave brand proxy around familiarity/recognition/liking. This is the closest public bridge to the intended brand-tracker wedge.

## Public-data selection criteria

A dataset receives priority when it has:

1. respondent-level microdata;
2. questionnaire/codebook;
3. explicit weights and methodology;
4. an expert publication or known analytical questions;
5. repeated waves or comparable variables;
6. SPSS or a format representative of agency work;
7. clear licensing;
8. enough complexity to expose routing, grids, missingness or weighting errors.

Raw size is not the priority. A 2,000-row survey with excellent documentation and a difficult questionnaire is more valuable for this programme than a million-row generic Kaggle table.
