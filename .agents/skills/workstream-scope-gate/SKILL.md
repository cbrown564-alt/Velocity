---
name: workstream-scope-gate
description: Use when assessing whether a proposed feature, refactor, eval, or UI workstream fits Velocity's feature matrix and stabilization priorities before investing implementation time.
---

# Workstream Scope Gate

Use this skill when deciding whether to continue, narrow, defer, or stop a workstream — especially during stabilization.

## Workflow

1. State the workstream in one sentence.
2. Read scope context:
   - `docs/blue_02_feature_matrix.md` — in/out of scope
   - `docs/roadmap_00_strategic_guide.md` — sequencing
   - `docs/tracker_00_implementation_status.md` — whether a tracked item exists
   - `AGENTS.md` — current priority (stabilization before expansion)
3. Identify the user or agent decision this work informs (export quality, workspace reopen, eval gap, engine contract, etc.).
4. Check success criteria:
   - tracker item ID or explicit acceptance test
   - eval outcome pattern from `docs/eval_framework.md`, if agent-facing
   - invariant checklist from `AGENTS.md` §2, if architectural
5. Compare value against cost:
   - files and consumers touched
   - risk to stats correctness, dual-state, or session compatibility
   - opportunity cost vs open stabilization items
6. Recommend: proceed, narrow, park in backlog, or stop.

## Value Questions

- Does this advance a named tracker item or documented stabilization gate?
- If not on the tracker, does feature matrix explicitly allow it?
- Does this reduce agent/human capability gap with frozen eval evidence?
- Is there a smaller change that proves the same hypothesis?
- Are we polishing deliverables while core contracts (engine, session, data model) are still unstable?

## Warning Signs

- new surface area during stabilization without scope-matrix justification
- MCP or UI features that duplicate engine logic
- chart/export work before data and weighting contracts are trustworthy
- eval expansion without a decision-linked brief
- architecture refactors not tied to a failing invariant or eval pattern

## Completion Criteria

Before finishing, summarize:

- scope gate result (in / narrow / out)
- evidence from feature matrix, tracker, and roadmap
- success criterion
- recommended next action
