# EVAL-05 Capability Gap Review

## Strategic Read

`EVAL-05` is the first Phase 4 run that demonstrates a real bounded harmonization loop on the live product substrate. Two adjacent ELSA IFS-derived waves were loaded into one browser workspace session, a shared health construct was auto-matched and explicitly confirmed, a harmonized table was created, and the resulting workspace state was exported as a portable session.

That is meaningful evidence: cross-wave work in Velocity is no longer just a Phase 5 architecture claim. On a narrow but legitimate longitudinal slice, it actually works.

## Major Findings

### 1. The browser harmonization workspace can complete a bounded end-to-end run

- Class: Benchmark baseline validated
- Judgment: Harmonization is now execution-real for at least one disciplined adjacent-wave task.
- Evidence: Wave 4 and Wave 5 ELSA IFS-derived files were both present in the same workspace, `srh3_hrs` auto-matched exactly, and `harm_eval05_wave4_wave5_srh3_hrs` was built with `21,324` rows.

This closes the biggest open question hanging over family `E`: whether the intended path was still too ambiguous to finish at all.

### 2. The strongest current path is browser-native, not MCP-native

- Class: Interface / workflow gap
- Judgment: The product capability exists, but the agent-facing access path still lags.
- Evidence: the checked-in agent quickstart remains explicitly single-dataset, while the successful eval depended on the browser workspace retaining two tables and a harmonization session.

That is not a reason to reject the success. It is a precise statement about where the surface asymmetry still lives.

### 3. Bounded confirmation discipline matters more than bulk auto-match volume

- Class: Product-usage lesson, not blocker
- Judgment: The important successful behavior was not that `433` variables auto-matched; it was that the workspace allowed one inspectable, exact, no-warning construct to be reviewed and confirmed without improvisation.
- Evidence: only `srh3_hrs -> srh3_hrs` was confirmed and applied, even though hundreds of other suggestions existed.

This is the right interpretation for Phase 4. The goal is not to maximize auto-confirmations; it is to prove the reviewable intended path.

### 4. The current output semantics are still slightly too raw

- Class: Rough-edge / deliverable gap
- Judgment: The harmonized table is technically correct but not yet as self-explanatory as it should be.
- Evidence: the output marks source/target as `_wave = 1/2` rather than preserving original wave numbers `4/5` directly.

That is a polish issue, not an architectural blocker. Still, it matters for making harmonized artifacts easier to review without auxiliary notes.

## Sufficiency Assessment

For adjacent ELSA IFS-derived files and a single exact health construct, the harmonization workspace is sufficient. The eval stayed on the real browser product path, produced inspectable artifacts, and required no product code change.

What is still unvalidated is how well this holds when:

1. the wave pair is less structurally aligned
2. the construct requires meaningful manual remapping
3. the operator must stay inside literal click-level UI interaction rather than a thinner browser-store harness
4. the agent must drive the workflow from the MCP surface alone

Those are follow-on questions for `S4-EVAL-4` and later product shaping, not reasons to deny the present result.

## Recommended Next Investments

1. Add a real agent-facing multi-dataset / workspace contract so harmonization is not functionally browser-only.
2. Preserve actual wave identifiers in harmonized outputs and exports.
3. Rerun harmonization later on a slightly less exact construct to test the manual-review step more deeply.
