# Gate 0: Operating Protocol Record

**Status:** Complete  
**Date:** 2026-06-27  
**Primary artifact:** `docs/deck_native_multi_agent_plan.md`

## Objective

Define a repeatable planner/designer/builder/evaluator workflow for the deck-native Velocity workstream before starting implementation.

## Acceptance Criteria

- [x] Roles and turn order are documented.
- [x] Claude invocation pattern is bounded and repeatable.
- [x] Claude workspace trust/login prerequisites are documented.
- [x] Evaluator reviews artifacts, not rationale.
- [x] Handoff artifacts are named and located.
- [x] First substages are defined with testable criteria.
- [x] Scope is tied to `PILOT-3`, `PILOT-5`, and `PILOT-6`.

## Claude Dry-Run Record

Four Claude Opus review attempts were made from `/Users/cobro/code/Velocity`.

Attempt 1:

- Command shape: `claude --model opus -p ... --permission-mode plan --output-format json`
- Result: no usable review artifact before manual interruption.
- Operational finding: workspace trust warning appeared; Claude attempted tool use and stalled under the requested planning task.

Attempt 2:

- Command shape: `claude --model opus -p ... --permission-mode plan --tools "" --output-format json --max-budget-usd 0.25`
- Result: failed with `error_max_budget_usd` before returning usable review content.
- Operational finding: the default budget was too low for full-artifact Opus review.

Attempt 3:

- Command shape: `claude --bare --model opus ... --tools ""`
- Result: failed with `Not logged in`.
- Operational finding: `--bare` bypasses the local login context and is not usable here unless API-key auth is configured.

Attempt 4:

- Command shape: `claude --model opus -p ... --permission-mode plan --tools "" --output-format json --max-budget-usd 0.75`
- Result: command completed, but the returned `result` field was not the requested evaluator JSON and did not include a pass/fail verdict.
- Operational finding: the workspace still emitted the trust warning, and disabling tools meant Claude tried to inspect files it could not read instead of reviewing the supplied artifact summary.

Protocol adjustment:

- `docs/deck_native_multi_agent_plan.md` now documents login/trust prerequisites, a higher default review budget, and a fallback rule when Claude review cannot produce an artifact.
- `docs/workstreams/deck_native/00_protocol_evaluator_review.md` records the unusable Claude review attempt and the fallback decision.

## Scope Gate Result

Result: **in scope, narrow.**

Evidence:

- Roadmap: the active critical path is the SAV-to-deck pilot wedge, not Phase 5 expansion.
- Tracker: the workstream is tied to `PILOT-3` PowerPoint loop, `PILOT-5` bounded agent outcomes, and `PILOT-6` paid-pilot evidence.
- Feature matrix: editable PPTX/export work is kept; generic dashboard building, broad SPSS replacement, cloud collaboration, WebR/raking, and generic AI chat remain delayed, rejected, or pilot-gated.

Success criterion:

- Gate 1 may define the deck-native product primitive and first implementation slice, but implementation remains limited to the smallest slice that improves defensible editable-deck workflow evidence.

Recommended next action:

- Proceed to Gate 1 designer spec using `docs/workstreams/deck_native/01_charter/planner_brief.md`, then retry Claude with a trusted workspace or explicitly waive Claude review for that gate.

## Phase Transition Evidence

- Builder handoff: `docs/workstreams/deck_native/00_protocol_builder_handoff.md`
- Evaluator/fallback record: `docs/workstreams/deck_native/00_protocol_evaluator_review.md`
- Checks recorded: documentation review, scope-gate review, Claude dry-run attempts.

## Gate 0 Decision

Gate 0 is complete by the documented fallback path: docs review passed, scope remains tied to the pilot wedge, the Claude evaluator path has a recorded blocker, and the human owner requested Phase 0 completion on 2026-06-27. This is not a Claude evaluator pass; Claude review should be retried before treating future gates as externally reviewed.

## Risks

- Claude review cannot be treated as a hard gate until the local trust/login path is confirmed.
- Long prompts can exceed budget without producing useful structured output.
- Full-document review should be avoided unless a schema and budget are set.
