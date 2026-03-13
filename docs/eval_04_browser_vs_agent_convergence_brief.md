# Agent Evaluation: Browser vs Agent Convergence

## Research Brief

**Dataset:** `test_data/sleep.sav`  
**Task:** Produce a 5-slide deck on sleep quality by demographics.  
**Family:** D (browser-agent convergence)

### Background

Convergence is only real if the browser and MCP paths can produce comparably strong outputs from the same substrate.

This eval uses a deliberately controlled task so the comparison focuses on interface quality rather than discovery difficulty.

### Task

Both the browser user and the agent must complete the same assignment:

- Produce a 5-slide deck on sleep quality by demographics
- Use the same dataset
- Cover the same core variables where reasonable:
  - sleep quality or satisfaction
  - gender/sex
  - age or age grouping
  - one additional demographic break of the analyst's choice

### Deliverable

- Browser-produced deck export
- Agent-produced deck export
- Side-by-side comparison of workflow and output quality

---

## Evaluation Framework

### Comparison Axes

Score both paths on:

- variable selection quality
- chart quality and readability
- export fidelity
- total effort
- number and severity of workarounds
- ease of making one last-minute slide edit

### What We Expect the Process to Look Like

1. **Browser run**: Human completes the task using the app UI only.
2. **Agent run**: Agent completes the same task through MCP only.
3. **Comparison**: Outputs are reviewed side-by-side using the scorecard and process log.

### Success Criteria

- Neither path requires undocumented workarounds for a basic 5-slide deck.
- Result quality is broadly comparable.
- Any meaningful gap is attributable to a specific affordance that can be named and scheduled.

### Failure Criteria

- The browser path is materially stronger for reasons that are hidden from the engine/MCP surface.
- The agent path can complete the task only by using extra scripting or off-path logic.

### Expected Duration

One focused browser session and one focused agent session. Each should be short enough that friction is obvious.

### Potential Pitfalls

| Risk | Description | Likelihood |
|---|---|---|
| Silent browser advantage | Browser user benefits from affordances the agent cannot access or discover | High |
| Agent-safe but weak output | Agent succeeds mechanically but produces a flatter, less readable deck | Medium |
| Task drift | Browser and agent runs pick different scopes, making comparison noisy | Medium |

### Expected Outcomes

**Good outcome:** Both paths produce credible 5-slide decks with only minor differences in polish or speed.

**Poor outcome:** The browser path clearly outperforms the agent path because the effective product surfaces still diverge.
