---
name: grill-with-docs
description: Stress-test a plan against the current codebase, docs, AGENTS.md, architecture notes, and existing patterns before implementation.
---

Stress-test my plan, but ground every question in the repository.

Before asking me anything:
1. Read `AGENTS.md`, `docs/README.md`, and docs/playbooks relevant to the plan.
2. Check `docs/tracker_00_implementation_status.md` and `docs/blue_02_feature_matrix.md` for scope and sequencing.
3. Search the codebase for existing patterns.
4. Identify likely affected modules, tests, schemas, APIs, and config (include `src/core/`, `src/engine/`, worker, MCP if relevant).
5. Answer any question that can be answered from the repo yourself.

Then interview me one question at a time.

For each question:
- cite the repo evidence or file path that motivated it
- explain the decision it blocks
- provide your recommended answer
- wait for my answer before continuing