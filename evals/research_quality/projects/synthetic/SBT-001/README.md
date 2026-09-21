# SBT-001 synthetic tracker

Current generation version: `synthetic_brand_tracker_v2`; analysis: `turn4-v2`; agency exports: `agency-v2`.

Run the three builders and regression suite in [`scripts/python/synthetic_tracker/README.md`](../../../../../scripts/python/synthetic_tracker/README.md) from the repository root. The canonical and agency CSVs and intermediate reference files are generated artifacts. Compact reports record the latest checked materialisation.

Historical v1 reports are retained in `hidden/history/v1/` and `reference/analysis/history/v1/`. Their image-routing PASS was incorrect: structural missing code 97 entered the familiar-brand universe. Corrected v2 uses codes 3/4/5 and independent validation. Historical story/design references must be checked against the corrected analysis before reuse.

The manifest points to generated findings; no verified v2 reference deck is supplied. Artifact provenance and deck limitations are in `docs/workstreams/research_quality/sbt_001_turn6_visual_language.md`.
