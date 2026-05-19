---
name: plan-to-kanban
description: Use when converting a loose plan, outline, brainstorm, research agenda, implementation idea, or milestone into a dependency-aware Kanban board that tracks progress, blockers, task ownership, and opportunities for parallel work.
---

# Plan To Kanban

Use this skill when a plan is too loose to execute safely, or when work needs dependency tracking, parallelization, or visible progress.

The goal is to turn vague intent into a board where each card is independently understandable and has a clear next action.

## Workflow

1. Read the source plan, issue, conversation, or existing board (`docs/tracker_00_implementation_status.md` for Velocity execution items).
2. Identify the goal, deliverables, constraints, and definitions of done.
3. Break the work into cards that are small enough to complete or review independently.
4. Mark dependencies between cards.
5. Identify cards that can run in parallel.
6. Separate discovery work from implementation work.
7. Call out blockers, open questions, and decision points.
8. Suggest the first pull of work: the smallest set of cards that unblocks the rest.

## Maintenance Mode

Use maintenance mode when a run, implementation task, or research note has changed the state of the project.

1. Find the existing card or section that the work belongs to before adding a new card.
2. Move completed work to `Done` or update its notes with concrete artifacts.
3. Record run IDs, metric snapshots, important caveats, and validation commands.
4. Move newly discovered failure modes into `Ready`, `Blocked`, or `Questions` instead of burying them in prose.
5. Refresh `Dependency Notes`, `Parallelization Opportunities`, and `Recommended Next Pull` when the result changes sequencing.
6. Avoid duplicating cards whose outcome is already represented elsewhere.

## Visual Companion

For complex boards, maintain a visual dependency view in addition to the Markdown board.

Preferred path:

1. Keep the Markdown Kanban as the source of truth.
2. If the user only needs a quick visual, generate a minimal Mermaid DAG from card titles and `Dependencies` fields.
3. If visuals will be reused, prefer a persistent generated artifact over regenerating diagrams in conversation. For Velocity, the tracker DAG in `docs/tracker_00_implementation_status.md` is often sufficient; use a separate `docs/kanban_plan.md` only when the user wants a research or experiment board distinct from the execution tracker.
4. Build a standalone UI only after the card format is regular enough to parse automatically and the UI can read from the source board without manual transcription.

Visuals should show dependencies and blockers, not every note. Keep detailed rationale in the Markdown board so the graph stays compact.

## Board Shape

Use these columns by default:

- `Backlog`: useful but not ready or not urgent.
- `Ready`: clear enough to start now.
- `In Progress`: actively being worked.
- `Blocked`: waiting on a decision, dependency, data, environment, or external result.
- `Review`: implemented or drafted, needs validation.
- `Done`: completed and verified.

For research-heavy work, add:

- `Questions`: unresolved decisions that change implementation.
- `Experiments`: runs or ablations with hypotheses and metrics.

## Card Format

Each card should include:

- `Title`: imperative, specific, and short.
- `Outcome`: what exists when the card is done.
- `Dependencies`: card titles or `none`.
- `Parallelizable`: `yes`, `no`, or `after <dependency>`.
- `Owner`: named person/agent if known, otherwise `unassigned`.
- `Validation`: test, review, artifact, metric, or command that proves completion.
- `Notes`: only if needed to prevent misunderstanding.

## Dependency Rules

- Put foundation work before dependent implementation, but do not over-serialize independent work.
- Mark discovery cards as blockers only when their answer changes the implementation.
- If two cards touch the same files or concepts, flag possible merge or design conflicts.
- Prefer narrow cards with clean handoff boundaries over broad cards that hide multiple decisions.
- Make validation cards explicit when correctness is high-risk.

## Parallelization Pass

After drafting the board, add a short parallelization summary:

- cards safe to run immediately in parallel
- cards blocked on the same dependency
- cards that should stay single-threaded because they define shared contracts
- recommended first 1-3 cards to start

## Completion Criteria

Before finishing, provide:

- the Kanban board
- dependency notes
- parallelization opportunities
- recommended next pull of work
- changed cards or sections, when updating an existing board
- visual artifact path or Mermaid diagram, when a visual companion was requested or updated
