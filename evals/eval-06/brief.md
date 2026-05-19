# Agent Evaluation: Stress Run on WVS

## Research Brief

**Primary dataset:** `test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav`  
**Fallback dataset:** `test_data/People_s Trust - A Survey-Based Experiment/trust.sav`  
**Family:** F (stress and edge cases)

### Background

This eval is designed to test resilience rather than elegance. The question is whether Velocity still supports a meaningful agent workflow when the dataset is large, noisy, internationally sourced, and operationally brittle.

WVS is the first-choice stress case because it combines size, weak naming, routing complexity, and known parser fragility.

### Task

1. Attempt the intended agent workflow on WVS Wave 7.
2. If parsing fails or the dataset is not usable, switch immediately to the Trust dataset and continue the stress eval there.
3. Produce a bounded findings summary on one coherent theme, not a full benchmark-style deck.

### Fallback Rule

Use the Trust dataset only if the WVS path is blocked by parse or ingestion failure. Record the exact failure in the process log and `summary.json`.

### Deliverable

- Stress-run process log
- Findings summary or smaller deck
- Clear record of whether WVS succeeded, partially succeeded, or fell back

---

## Evaluation Framework

### Resilience Definition

For this eval, resilience means:

- the agent can still orient itself without brute-force scanning every variable
- the workflow degrades gracefully when a dataset is messy or partially blocked
- failures are diagnosable and lead to a documented fallback rather than a dead end

### What We Expect the Process to Look Like

1. **Attempt WVS**: Load, describe, and begin discovery through the intended path.
2. **Assess viability**: Decide quickly whether the workflow is viable or blocked.
3. **Fallback if needed**: Shift to Trust without turning the run into bespoke scripting.
4. **Complete a bounded output**: Findings summary, small deck, or equivalent artifact.

### Success Criteria

- WVS works well enough to support a bounded analysis, or fallback activates cleanly with a documented reason.
- The agent remains inside the intended product path.
- Output is still reviewable even if the dataset is hostile.

### Failure Criteria

- Parse or discovery failure leaves no viable continuation path.
- The agent must escape into custom scripts to salvage the run.
- Failures are opaque enough that follow-up work cannot be scoped cleanly.

### Expected Duration

Variable. The first 5-10 steps should reveal whether WVS is viable. If not, fallback should happen immediately.

### Potential Pitfalls

| Risk | Description | Likelihood |
|---|---|---|
| WVS parse failure | Known ingestion issues may block the dataset before analysis starts | High |
| Naming opacity | Code-heavy variables make discovery slow and error-prone | High |
| Routing and missingness | Country-specific modules can look broken when they are merely conditional | High |

### Expected Outcomes

**Good outcome:** Either WVS supports a bounded but real analysis, or fallback keeps the eval productive without ad hoc repair work.

**Poor outcome:** The workflow collapses as soon as the data gets hostile, showing that current success is limited to friendly datasets.
