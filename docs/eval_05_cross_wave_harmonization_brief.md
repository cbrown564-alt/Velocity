# Agent Evaluation: Cross-Wave Harmonization

## Research Brief

**Dataset:** `test_data/English Longitudinal Study of Ageing/`  
**Family:** E (harmonization and cross-wave work)

### Background

Velocity's longitudinal and harmonization story is only credible if an agent can move beyond single-dataset analysis and use the workspace to compare equivalent constructs across waves.

This eval uses ELSA because it is a real multi-wave survey with naming drift and wave-to-wave variation that should pressure the harmonization workflow.

### Task

1. Load two ELSA wave files into the harmonization workflow.
2. Discover a shared construct that should exist across both waves.
3. Use the mapping and harmonization tools to propose cross-wave variable matches.
4. Review and refine mappings where needed.
5. Build a harmonized table and produce a short findings summary describing how the construct changed or remained stable across waves.

### Dependency Note

This eval is valid only if:

- the required ELSA wave files are available locally
- the harmonization workspace is mature enough to support the intended path end to end

If either prerequisite is missing, record the run as blocked rather than improvising a substitute inside the same eval ID.

### Deliverable

- Mapping decision log
- Harmonized table or equivalent export
- Brief narrative summary of the cross-wave result

---

## Evaluation Framework

### What We Expect the Process to Look Like

1. **Wave discovery**: Agent identifies candidate variables in each wave.
2. **Mapping**: Agent uses built-in matching tools rather than ad hoc spreadsheets or external scripts.
3. **Refinement**: Agent or human reviewer can inspect mappings and resolve mismatches.
4. **Harmonized output**: A single cross-wave table is produced and explained.

### Success Criteria

- Agent can propose plausible mappings through the intended workflow.
- The mapping review step is inspectable and explainable.
- Harmonized output is generated without dropping into undocumented side paths.

### Failure Criteria

- Agent cannot understand how to move from candidate variables to confirmed mappings.
- Harmonized output requires bespoke external glue code.
- The workflow is too opaque for a human to review the mapping decisions.

### Expected Duration

Longer than EVAL-01 to EVAL-04 because discovery happens across multiple datasets. The eval should still stay within a single bounded working session.

### Potential Pitfalls

| Risk | Description | Likelihood |
|---|---|---|
| Workspace immaturity | Required multi-dataset affordances are incomplete or inconsistent | High |
| Mapping ambiguity | Similar variables across waves diverge enough to require manual judgment | High |
| Discovery overload | Agent finds many plausible candidates but cannot narrow them to a clean mapping set | Medium |

### Expected Outcomes

**Good outcome:** Agent reaches a defensible harmonized analysis with inspectable mapping decisions and minimal off-path work.

**Poor outcome:** The agent can identify candidate variables but cannot complete the intended harmonization loop through Velocity itself.
