# Deck-Native Multi-Agent Delivery Plan

**Status:** Technical implementation complete through Gate 5; product/tracker acceptance remains gated by human review and pilot evidence; final verification passed with local mutation caveat
**Purpose:** Coordinate a planner/designer/builder/evaluator loop for moving Velocity toward a deck-native product posture without losing the current SAV-to-deck pilot focus.

Use this with:

- `docs/tracker_00_implementation_status.md` for active gates
- `docs/roadmap_00_strategic_guide.md` for sequencing
- `docs/blue_02_feature_matrix.md` for scope decisions
- `docs/agent_handoff_template.md` for owner transfers
- `docs/eval_framework.md` for artifact evaluation and capability-gap classification

## 1. Product Direction

Deck-native Velocity means the primary durable work object becomes a reusable client-report recipe, not an incidental export from an analysis surface.

Working primitive:

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

The Analysis Canvas remains the slide authoring and inspection hub. The Variable Manager remains the high-density ingredient organizer. Workspace becomes the entry point for client jobs, datasets, and repeatable report runs.

## 2. Scope Gate

This work is in scope only when it advances the active market-reset wedge:

> analysis-ready SAV file -> defensible, editable client deck.

Immediate alignment:

- `PILOT-3`: PowerPoint loop, template mapping, saved slide recipes, dataset/wave replacement, review-before-export.
- `PILOT-5`: bounded agent outcomes with manual control adjacent to every action.
- `PILOT-6`: paid-pilot evidence and observed workflow records.

Explicit non-goals until pilot evidence changes the gate:

- broad SPSS replacement
- generic dashboard builder
- unsupervised general-purpose analyst chat
- enterprise collaboration
- direct survey-platform imports
- WebR/raking unless repeatedly pilot-blocking
- template marketplace or broad theme expansion

## 3. Roles

### Planner / Product Manager

Owns phase framing and decision gates.

Outputs:

- substage brief
- user job
- in-scope and out-of-scope boundaries
- measurable good-enough criteria
- dependency and risk notes

The planner may be Codex, Claude Opus, or the human owner, but each substage needs one explicit planner artifact before design begins.

### Claude Opus Designer

Produces implementation-facing design specs. The designer does not edit files.

Inputs:

- planner brief
- relevant docs
- current code/file inventory when needed

Outputs:

- UX contract
- engine/session/export contract
- affected files and tests
- edge cases
- acceptance criteria
- review rubric for the evaluator

### Codex Builder

Implements the agreed substage.

Responsibilities:

- follow `AGENTS.md` and required playbooks
- preserve engine/core/UI boundaries
- add or update tests before or with behavior changes
- run agreed checks
- create a handoff using `docs/agent_handoff_template.md`

### Claude Opus Evaluator

Performs adversarial artifact review. The evaluator reviews outputs, not private rationale.

Allowed evidence:

- git diff
- changed files
- tests and command output
- screenshots or generated artifacts
- handoff document
- docs/contracts touched

Disallowed evidence:

- hidden chain-of-thought
- builder intent that is not reflected in code, tests, docs, or artifacts

Outputs:

- pass/fail by criterion
- findings ordered by severity
- concrete file/test references
- capability-gap classification where relevant
- required fixes before the next gate

### Human Gate

The human owner approves:

- phase starts
- scope expansion
- acceptance of known risks
- tracker status changes
- irreversible product direction changes

## 4. Turn Protocol

Each implementation substage follows this loop:

1. Planner writes the substage brief.
2. Claude Opus Designer writes the design spec.
3. Codex audits the spec against repo docs and code.
4. Codex and Claude converge on good-enough criteria.
5. Codex implements the smallest complete slice.
6. Codex writes a handoff artifact and runs checks.
7. Claude Opus Evaluator reviews artifacts adversarially.
8. Codex fixes or disputes findings with evidence.
9. Human approves the phase gate or sends the loop back.

The evaluator should never be asked "does Codex's reasoning make sense?" It should be asked "does the artifact satisfy the agreed criteria?"

## 5. Claude Code Invocation Pattern

Use bounded, artifact-oriented `claude -p` calls.

Prerequisites before relying on Claude review as a gate:

- Claude Code is logged in for the local user.
- The Velocity workspace trust dialog has been accepted for `/Users/cobro/code/Velocity`.
- A one-turn smoke test has returned usable JSON.
- The prompt contains only artifact evidence needed for the current phase.

Recommended defaults:

```bash
claude --model opus -p "$PROMPT" \
  --permission-mode plan \
  --tools "" \
  --output-format json \
  --max-budget-usd 0.75
```

Use `--tools ""` for pure design/review calls when Codex can provide the relevant artifact context in the prompt. Use read-only tools only when the workspace trust and permissions are confirmed, and keep the prompt narrow. Prefer concise summaries plus targeted diffs over entire documents when the review question is narrow.

When JSON shape matters, add a JSON schema or an explicit key list and word budget. If a Claude call times out, exceeds budget, or returns no usable artifact, record that as a failed review attempt and either retry with a narrower prompt or ask the human owner to approve proceeding without Claude review.

Designer prompt shape:

```text
You are the Designer. Do not edit files.
Given this planner brief and repo context, produce:
1. UX contract
2. engine/session/export contract
3. affected files
4. tests required
5. edge cases
6. good-enough criteria
7. evaluator rubric
```

Evaluator prompt shape:

```text
You are the Evaluator. Review artifacts only.
Inputs: agreed criteria, git diff, test output, handoff.
Return JSON with:
- verdict: pass | fail
- blocking_findings
- non_blocking_findings
- criteria_results
- required_fixes
- residual_risks
```

## 6. Document Trail

Create durable artifacts under `docs/workstreams/deck_native/`.

Suggested structure:

```text
docs/workstreams/deck_native/
  00_protocol.md
  00_protocol_builder_handoff.md
  00_protocol_evaluator_review.md
  01_charter/
    planner_brief.md
    designer_spec.md
    codex_audit.md
    builder_handoff.md
    evaluator_review.md
  02_readiness_panel/
    planner_brief.md
    designer_spec.md
    builder_handoff.md
    evaluator_review.md
  03_recipe_persistence/
    planner_brief.md
    designer_spec.md
    builder_handoff.md
    evaluator_review.md
  04_dataset_replacement/
    planner_brief.md
    designer_spec.md
    builder_handoff.md
    evaluator_review.md
  05_bounded_agent_drafting/
    planner_brief.md
    designer_spec.md
    builder_handoff.md
    evaluator_review.md
  06_final_verification.md
  07_report_quality_experience_plan.md
  ...
```

For code ownership transfers, each `builder_handoff.md` should follow `docs/agent_handoff_template.md`.

Tracker updates should happen only when a substage changes official project status, scope, or gates. Otherwise this workstream document is the local source of truth.

## 7. Good-Enough Gates

### Gate 0: Operating Protocol

Good enough means:

- roles and turn order are documented
- Claude invocation pattern is bounded and repeatable
- Claude workspace trust/login prerequisites are documented
- evaluator reviews artifacts, not rationale
- handoff artifacts are named and located
- first substages are defined with testable criteria
- scope is tied to `PILOT-3`, `PILOT-5`, and `PILOT-6`

Validation:

- docs review
- one bounded Claude designer or evaluator dry run, or a recorded blocker plus fallback decision
- no code changes required

Gate 0 completion evidence:

- `docs/workstreams/deck_native/00_protocol.md`
- `docs/workstreams/deck_native/00_protocol_builder_handoff.md`
- `docs/workstreams/deck_native/00_protocol_evaluator_review.md`

### Gate 1: Deck-Native Charter

Good enough means:

- `Report Job` / `Deck Recipe` contract is defined at product level
- existing primitives are mapped to the contract
- explicit non-goals prevent broad expansion
- first code slice is selected

Validation:

- product/design review
- scope-gate pass against roadmap, tracker, and feature matrix

### Gate 2: Deck Readiness Diagnostics

Good enough means a user can inspect a deck before export and see:

- selected export scope
- valid and invalid slides
- missing row/column/filter/weight variables
- template binding status
- warnings that will affect export
- whether export is blocked or allowed

Validation:

- unit tests for readiness computation
- component tests for diagnostics display
- targeted export modal or deck surface tests
- `npm run typecheck`
- targeted `npm run test:run -- <changed-tests>`

### Gate 3: Persistent Deck Recipe Surface

Good enough means:

- slide recipes are visible as durable deck state, not only hidden export/session machinery
- deck-level recipe metadata survives session export/import
- recipe state does not duplicate respondent rows
- invalid recipe references surface diagnostics instead of failing silently

Validation:

- session round-trip tests
- recipe conversion tests
- deck timeline or inspector component tests
- session compatibility review

### Gate 4: Dataset Replacement Review

Good enough means:

- user can assess whether a deck survives a replacement dataset or wave
- missing or changed variables are grouped by slide
- export is blocked only for selected slides with unresolved blockers
- diagnostics are understandable without raw internal IDs

Validation:

- replacement assessment unit tests
- UI tests for blocking and non-blocking cases
- manual check with at least one compatible and one incompatible fixture

### Gate 5: Bounded Agent Drafting

Good enough means:

- agent can propose a deck plan through intended engine/MCP surfaces
- human approval is adjacent to each proposed action
- all generated slides carry provenance
- notes and caveats are visible and editable
- evaluator can score the run using `docs/eval_framework.md`

Validation:

- MCP/engine flow tests
- eval-style run artifact
- artifact review by Claude Opus evaluator
- human acceptance gate before tracker status changes

## 8. Initial Kanban

### Done

| Card | Outcome | Dependencies | Validation |
| :--- | :--- | :--- | :--- |
| Establish operating protocol | Roles, turn order, Claude invocation rules, artifact trail, fallback rule, and initial scope gates are documented | none | Gate 0 complete via docs review plus recorded Claude blocker/fallback decision |
| Draft Deck-Native Charter | Product primitive and first implementation slice selected | Gate 0 | Gate 1 complete via designer fallback spec, Codex audit, and evaluator fallback record |
| Design Deck Readiness Diagnostics | UX/API/test spec for readiness panel | Gate 1 | Gate 1 designer spec + Codex audit |
| Implement readiness computation | Pure readiness function with tests | Readiness design | Gate 2 unit tests + typecheck |
| Surface readiness in UI | User-facing readiness panel or export-review surface | readiness computation | Gate 2 component tests + typecheck |
| Persist deck recipe metadata | Session-safe deck recipe state | charter | Gate 3 session tests + typecheck |
| Dataset replacement review | Wave/dataset replacement diagnostics | readiness + recipe persistence | Gate 4 unit tests + typecheck |
| Agent draft workflow | Bounded agent proposes approval-required deck actions through engine/MCP; row/column/filter/weight caveats and malformed-spec rejection are tested | readiness + recipe persistence | Gate 5 engine/MCP tests + typecheck |
| Final verification + PR review | Full changed-surface checks and human review | Gates 1-5 | full tests, build, typecheck, guards passed; mutation deferred/CI |

### Ready

| Card | Outcome | Dependencies | Validation |
| :--- | :--- | :--- | :--- |
| PR review / merge decision | Human review of completed deck-native technical workstream before any `PILOT-5` tracker promotion | final verification | PR checklist, mutation/CI decision, and pilot-evidence decision |
| Report quality experience plan | User stories, PPTX quality rubric, UX smoothness standard, configurability/story-building roadmap, and evaluation harness | final verification | `docs/workstreams/deck_native/07_report_quality_experience_plan.md` reviewed by human owner |

### Next

| Card | Outcome | Dependencies | Validation |
| :--- | :--- | :--- | :--- |
| Recipe manager/time travel | Repeatable transformation history | PILOT-4a/PILOT-6 evidence | pilot blocker evidence |

### Pilot-Gated

| Card | Outcome | Dependencies | Validation |
| :--- | :--- | :--- | :--- |
| Dataset replacement review | Wave/dataset replacement diagnostics | readiness + recipe persistence | Gate 4 |
| Agent draft workflow | Bounded agent proposes deck actions | readiness + recipe persistence | Gate 5 |
| Recipe manager/time travel | Repeatable transformation history | PILOT-4a/PILOT-6 evidence | pilot blocker evidence |

### Parked

| Card | Reason |
| :--- | :--- |
| WebR/raking | Frozen unless repeatedly pilot-blocking |
| Cloud collaboration | Frozen until ICP shifts to teams |
| Generic AI analyst chat | Conflicts with bounded outcome posture |
| Dashboard builder | Distracts from editable client deck wedge |

## 9. Phase Transition Rule

A phase may advance only when:

1. agreed criteria are satisfied or explicitly waived by the human owner
2. builder handoff exists
3. evaluator review exists or the human explicitly skips it
4. tests/checks are recorded
5. remaining risks are named

If criteria are ambiguous, stop and rewrite the criteria before writing code.
