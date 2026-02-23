# Agent Handoff Template

Use this for every ownership transfer in multi-agent work.

## 1) Context
- Request/goal:
- Scope boundaries (explicit non-goals):
- Owner role handing off:
- Next owner role:

## 2) Changes
- Branch:
- PR/commit refs:
- Files changed:
- What changed and why:

## 3) Contracts
- Interfaces/types/schemas touched:
- Backward compatibility impact:
- Required downstream updates:
- Dual-state model impact (raw codes + labels):

## 4) Invariant Check
- [ ] `src/core/*` remains platform-independent (no React/DOM/browser APIs)
- [ ] Heavy compute remains in Worker
- [ ] Dependency direction preserved (`core` -> adapters injected; no inverted coupling)
- [ ] UX mode/theme token constraints respected (if UI touched)

Notes/evidence:

## 5) Checks Run
Paste exact commands and outcomes.

```bash
# example
# npm run typecheck
# npm run lint
# npm test -- <target>
```

Results:
- [ ] Typecheck
- [ ] Lint
- [ ] Unit tests
- [ ] Integration/golden tests (if applicable)
- [ ] Manual verification (if applicable)

## 6) Risks
- Known issues / edge cases:
- Confidence level:
- Monitoring/follow-up needed:

## 7) Next Actions (for next owner)
- Immediate next step:
- Blockers/dependencies:
- Suggested order:

## 8) Done Criteria for Next Owner
- Concrete acceptance checks the next owner should satisfy before re-handoff.
