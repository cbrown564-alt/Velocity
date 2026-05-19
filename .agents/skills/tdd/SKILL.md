---
name: tdd
description: Use when implementing a behavior change with test-driven development. First write or update a failing test that captures the desired behavior, then implement the smallest change to pass it, then refactor while keeping tests green. Do not use for purely mechanical refactors or formatting-only changes.
---

# TDD

Follow this loop:

1. Understand the requested behavior.
2. Find the closest existing test file or test pattern (`docs/arch_08_testing.md` for layer and layout).
3. Write the smallest failing test that captures the new behavior.
4. Run only the relevant test first (`npm test` for watch; `npm run test:run` for CI-style single pass).
5. Confirm the failure is meaningful and caused by the missing behavior, not setup issues.
6. Implement the smallest production-code change that makes the test pass.
7. Re-run the focused test.
8. Run the broader relevant test suite.
9. Refactor only after tests pass.
10. Summarize:
   - test added
   - implementation changed
   - commands run
   - remaining risks