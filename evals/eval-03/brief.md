# Agent Evaluation: Session Handoff Round-Trip

## Research Brief

**Dataset:** Reuse the completed `sleep.sav` workflow from EVAL-01 as the baseline handoff path.  
**Primary artifact:** Agent-authored `.velocity` session plus a browser-refined follow-up session.  
**Family:** C (session handoff and browser refinement)

### Background

Velocity's handoff thesis is that an agent should be able to leave behind work a human can open, inspect, refine, and continue without reconstructing the analysis from scratch.

This eval does not ask whether the initial analysis is interesting. It asks whether the handoff primitive is real.

### Task

1. Start from the intended agent path on `test_data/sleep.sav`.
2. Produce a small but coherent deck from the dataset.
3. Export a `.velocity` session file through `velocity_export_session`.
4. Open that session in the browser with the matching dataset.
5. Make at least three human refinements:
   - reorder one slide
   - edit one title or note
   - add one follow-up analysis or slide
6. Re-export the refined session.

### Deliverable

- Original agent session file
- Browser-refined session file
- Short comparison note describing what survived, what changed, and what had to be rebuilt manually

---

## Evaluation Framework

### What We Expect the Process to Look Like

1. **Agent baseline**: Load, describe, analyze, build deck, export session through the documented MCP path.
2. **Import**: Browser loads the matching dataset and imports the agent session with no manual JSON edits.
3. **Inspection**: Human can see filters, weight state, sections, slides, and semantic annotations in an inspectable form.
4. **Refinement**: Human edits are incremental, not a rebuild.
5. **Re-export**: Refined session serializes cleanly and remains portable.

### Success Criteria

- Filters survive the round-trip intact.
- Weight state survives the round-trip intact.
- Slides and sections survive with their authored ordering and notes.
- Semantic annotations and concepts are visible after import.
- Provenance remains inspectable through the session and slide state.
- Human refinement is additive. The user should not need to recreate the original deck manually.

### Failure Criteria

- Imported session drops slides, filters, or semantic state without clear diagnostics.
- Human must reconstruct core analysis state by hand.
- The browser can open the session only after undocumented repair steps.

### Expected Duration

10-15 total workflow actions across agent and browser paths. This should be a low-friction eval if the intended handoff path is real.

### Potential Pitfalls

| Risk | Description | Likelihood |
|---|---|---|
| Missing semantic restore | Imported session opens but annotations/concepts are absent or incomplete | Medium |
| Deck state mismatch | Slides exist in the session but do not appear as expected in the browser workflow | Medium |
| Weak diagnostics | Import technically succeeds but silently drops state the human needed | High |

### Expected Outcomes

**Good outcome:** Agent session opens cleanly, human makes focused refinements, and the refined session re-exports with minimal friction.

**Poor outcome:** Session import succeeds only partially, forcing the human to rebuild the deck or re-annotate the dataset manually.
