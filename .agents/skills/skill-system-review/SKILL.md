---
name: skill-system-review
description: Use when reviewing project skills against recent git history, conversation history, repo docs, repeated workflows, and development failure modes to decide whether skills need tuning or new skills should be added.
---

# Skill System Review

Use this skill when the user asks for a repo skills review or asks whether the skill set still fits the project.

## Workflow

1. Inventory current skills under `.agents/skills`.
2. Read `AGENTS.md`, `docs/README.md`, `docs/tracker_00_implementation_status.md`, `docs/roadmap_00_strategic_guide.md`, and relevant playbooks or eval docs for the active workstream.
3. Inspect recent git history for repeated file clusters, repeated fixes, reverted directions, or recurring validation patterns.
4. Review available conversation context for workflows the user repeatedly asks Codex to perform.
5. Compare skill instructions against actual development behavior:
   - are skills triggering for the right work?
   - are they too vague, too broad, or stale?
   - are important repo-specific lessons only living in docs or chat?
   - are common failure modes covered by procedural guardrails?
6. Recommend updates to existing skills before adding new skills.
7. Add a new skill only when the workflow is repeated, high-risk, or meaningfully different from existing skills.

## Review Signals

Good candidates for skill tuning:

- repeated commits touching the same contract
- repeated model/provider failures
- recurring documentation or run-artifact cleanup
- scorer or dataset mistakes that tests alone do not prevent
- workflows that require reading multiple repo docs in a specific order

Avoid creating skills for one-off preferences, temporary experiments, or information that belongs in ordinary docs.

## Completion Criteria

Before finishing, summarize:

- skills reviewed
- git history and docs inspected
- skills that are working as expected
- skills that need tuning
- new skills recommended or added
- unresolved process risks
