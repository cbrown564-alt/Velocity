---
name: dual-state-data
description: Use before changing ingestion, variable metadata, harmonization, weighting, crosstabs, exports, or any code that reads or writes categorical survey values. Preserve integer codes and display labels together.
---

# Dual-State Data

Use this skill when work depends on what survey values *mean*, not just how they are stored or displayed.

Survey-native correctness in Velocity requires the **dual-state model**: categorical data keeps both underlying codes and human-readable labels. Breaking either side causes silent analysis errors.

## Required Reading

Before implementing or changing behavior, read:

- `docs/arch_02_data_model.md`
- `AGENTS.md` §2 (Data model integrity)
- the closest existing ingestion, harmonization, or stats code paths

## Workflow

1. Identify affected surfaces: ingest, variable manager, harmonization, stats, charts, export, session, MCP/engine outputs.
2. Trace how values flow: raw storage → labeled display → aggregation → export/deck.
3. Verify both code and label are preserved at each boundary:
   - `ValueLabel` mappings stay intact
   - missing-value definitions are respected
   - weight application does not collapse categories incorrectly
4. Search for anti-patterns:
   - stringifying codes for keys without retaining numeric identity
   - comparing labels when codes are authoritative (or vice versa) without an explicit rule
   - dropping `valueLabels` during harmonization or session round-trip
5. Add or update tests at the lowest layer that can catch the regression (unit for pure transforms; integration when worker/store is involved).

## High-Risk Checks

- SPSS/SAV ingest and export round-trips
- harmonization and recode operations
- crosstab denominators and category ordering
- deck/chart legends vs underlying table values
- session import/export of variable metadata
- agent-facing tables that show labels but aggregate on codes

## Completion Criteria

Before finishing, summarize:

- which dual-state paths were inspected
- what invariant the change now relies on
- tests added or updated
- any unresolved ambiguity or follow-up
