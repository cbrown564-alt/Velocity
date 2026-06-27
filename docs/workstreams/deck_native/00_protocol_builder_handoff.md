# Gate 0 Builder Handoff: Operating Protocol

## 1) Context

- Request/goal: Complete Phase 0 / Gate 0 of `docs/deck_native_multi_agent_plan.md`.
- Scope boundaries (explicit non-goals): no product code, no tracker status change, no Phase 5 expansion, no generic dashboard/chat/cloud/WebR work.
- Owner role handing off: Codex Builder.
- Next owner role: Claude Opus Designer for Gate 1, or human owner if Claude workspace trust remains blocked.

## 2) Changes

- Branch: `main`
- PR/commit refs: not committed.
- Files changed:
  - `docs/deck_native_multi_agent_plan.md`
  - `docs/workstreams/deck_native/00_protocol.md`
  - `docs/workstreams/deck_native/00_protocol_builder_handoff.md`
  - `docs/workstreams/deck_native/00_protocol_evaluator_review.md`
  - `docs/workstreams/deck_native/01_charter/planner_brief.md`
  - `docs/README.md`
- What changed and why: Gate 0 is marked complete, the operating-protocol card moved to Done, the protocol record now includes scope-gate evidence and the fourth Claude dry-run result, and this handoff plus evaluator/fallback record make the phase-transition evidence explicit.

## 3) Contracts

- Interfaces/types/schemas touched: none.
- Backward compatibility impact: none.
- Required downstream updates: Gate 1 designer spec should start from `docs/workstreams/deck_native/01_charter/planner_brief.md`.
- Dual-state model impact (raw codes + labels): none.

## 4) Invariant Check

- [x] `src/core/*` remains platform-independent (no React/DOM/browser APIs)
- [x] Heavy compute remains in Worker
- [x] Dependency direction preserved (`core` -> adapters injected; no inverted coupling)
- [x] UX mode/theme token constraints respected (if UI touched)

Notes/evidence:

- Documentation-only change.
- Scope gate result is narrow/in-scope only for the SAV-to-deck pilot wedge.
- Gate 0 does not define or change runtime behavior.

## 5) Checks Run

```bash
sed -n '1,220p' docs/README.md
sed -n '1,260p' docs/roadmap_00_strategic_guide.md
sed -n '1,320p' docs/tracker_00_implementation_status.md
sed -n '1,260p' docs/blue_02_feature_matrix.md
sed -n '1,520p' docs/deck_native_multi_agent_plan.md
sed -n '1,260p' docs/agent_handoff_template.md
sed -n '182,360p' docs/arch_07_agent_architecture.md
sed -n '490,612p' docs/arch_07_agent_architecture.md
claude --model opus -p "$PROMPT" --permission-mode plan --tools "" --output-format json --max-budget-usd 0.75
missing=0
for f in docs/deck_native_multi_agent_plan.md docs/workstreams/deck_native/00_protocol.md docs/workstreams/deck_native/00_protocol_builder_handoff.md docs/workstreams/deck_native/00_protocol_evaluator_review.md docs/workstreams/deck_native/01_charter/planner_brief.md; do
  if [ ! -f "$f" ]; then
    echo "missing $f"
    missing=1
  fi
done
test "$missing" -eq 0
if rg -n "[G]ate 0 ready|[r]eady for human approval|[T]wo Claude" docs/deck_native_multi_agent_plan.md docs/workstreams/deck_native -S; then
  exit 1
else
  echo "No stale Gate 0 labels found"
fi
```

Results:

- [ ] Typecheck
- [ ] Lint
- [ ] Unit tests
- [ ] Integration/golden tests (if applicable)
- [x] Manual verification (if applicable)

Typecheck, lint, unit, and integration tests were not run because Gate 0 is documentation-only and has no code changes.

## 6) Risks

- Known issues / edge cases: Claude Code still warns that `/Users/cobro/code/Velocity` is not trusted, and the latest dry run did not return usable evaluator JSON.
- Confidence level: medium-high for documentation completeness; medium for multi-agent automation until Claude trust/login is fixed.
- Monitoring/follow-up needed: retry Claude Opus Designer for Gate 1 after accepting workspace trust, or explicitly record a human waiver.

## 7) Next Actions (for next owner)

- Immediate next step: produce the Gate 1 designer spec from `docs/workstreams/deck_native/01_charter/planner_brief.md`.
- Blockers/dependencies: Claude workspace trust/login must be fixed before Claude review can be treated as a hard gate.
- Suggested order: trust/login smoke test, Gate 1 designer spec, Codex audit against repo docs/code, then evaluator review.

## 8) Done Criteria for Next Owner

- Gate 1 product primitive is defined.
- Existing deck/session/export primitives are mapped to the product primitive.
- First implementation slice is selected with testable criteria.
- Risks to session compatibility, export quality, engine boundaries, and UI mode boundaries are named.
