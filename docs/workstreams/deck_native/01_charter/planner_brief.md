# Gate 1 Planner Brief: Deck-Native Charter

**Status:** Ready for designer spec  
**Workstream:** Deck-native Velocity  
**Depends on:** Gate 0 operating protocol  

## User Job

As a boutique researcher or independent consultant, I want to start from a client reporting job rather than a blank analysis surface, so I can turn an analysis-ready SAV file into a defensible, editable client deck and repeat the same deck on future waves with less rework.

## Product Question

What is the smallest durable product primitive that makes Velocity feel deck-native while preserving the current engine, session, export, and local-first architecture?

Candidate primitive:

```text
Report Job =
  dataset fingerprint
  + client template and bindings
  + deck outline and slide recipes
  + banner/break plan
  + filters, weights, and recodes
  + readiness diagnostics
  + provenance and export history
```

## In Scope

- Define the user-facing names and boundaries for `Report Job`, `Deck Recipe`, and `Slide Recipe`.
- Map existing code primitives to those product concepts.
- Identify the first implementation slice, expected to be Deck Readiness Diagnostics unless the designer finds a better smaller slice.
- Preserve the current SAV-to-deck pilot wedge.
- Preserve local-first, engine/provenance, session, and dual-state data invariants.

## Out of Scope

- Broad SPSS replacement.
- General dashboard builder.
- Generic AI chat analyst.
- Cloud collaboration.
- Survey-platform imports.
- WebR/raking unless pilot evidence makes it blocking.
- Rewriting the application shell before a narrow deck-native slice proves value.

## Relevant Existing Primitives

- `src/engine/DeckBuilder.ts`
- `src/engine/VelocityEngine.ts`
- `src/core/export/slideRecipe.ts`
- `src/core/export/templateMapping.ts`
- `src/core/export/pptxExporter.ts`
- `src/core/session/sessionTypes.ts`
- `src/store/slices/slidesSlice.ts`
- `src/components/overlays/ExportModal.tsx`
- `mcp-server/handlers/deck.ts`

## Required Designer Output

Claude Opus Designer should produce:

1. Product contract: definitions for Report Job, Deck Recipe, Slide Recipe, and Deck Readiness.
2. UX contract: where these concepts should surface first without a full shell rewrite.
3. Architecture contract: which concepts belong in `core`, `engine`, session, store, and UI.
4. Test contract: specific unit/component/session tests required for the first implementation slice.
5. Edge cases: missing variables, stale slide state, template mismatch, dataset replacement, empty slides, weighted slides, filters.
6. First slice recommendation: proceed with Deck Readiness Diagnostics or choose a smaller prerequisite.
7. Good-enough criteria for Gate 1 and Gate 2.
8. Evaluator rubric for adversarial review.

## Gate 1 Acceptance Criteria

Gate 1 is good enough when:

- The deck-native product primitive is explicitly defined.
- Existing code concepts are mapped to the primitive.
- The first implementation slice is selected and justified.
- The slice has testable acceptance criteria.
- The design avoids broad expansion beyond `PILOT-3`, `PILOT-5`, and `PILOT-6`.
- Risks to session compatibility, export quality, and UI mode boundaries are named.

## Suggested Claude Designer Prompt

```text
You are Claude Opus Designer for Velocity's deck-native workstream. Do not edit files.

Review this Gate 1 planner brief and produce an implementation-facing designer spec.
Evaluate the candidate primitive:
Report Job = dataset fingerprint + client template/bindings + deck outline/slide recipes + banner plan + filters/weights/recodes + readiness diagnostics + provenance/export history.

Return:
1. Product contract
2. UX contract
3. Architecture contract
4. Tests required
5. Edge cases
6. First slice recommendation
7. Gate 1 and Gate 2 good-enough criteria
8. Evaluator rubric

Review artifacts and repo contracts only. Do not rely on private rationale.
```

