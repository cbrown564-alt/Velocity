# Cursor capacity sprint plan

**Status:** proposed execution plan  
**Created:** 29 July 2026  
**Scope:** bounded use of Composer 2.5, Grok 4.5, and GLM 5.2 before subscription capacity expires  
**Canonical status owner:** `docs/tracker_00_implementation_status.md`

## Purpose

Use short-lived model capacity to move Velocity through the existing design-convergence critical path without reopening settled product decisions or creating another competing roadmap.

This document is an execution aid. It does not replace the implementation tracker, strategic roadmap, feature matrix, architecture documents, or design decisions. When work lands, update the canonical tracker in the same pull request.

## Desired outcome

Move the current product line from conflicting off-main redesign candidates toward one testable five-minute journey:

> file drop → three faithful slides → review → PPTX

The sprint succeeds if it reduces integration uncertainty and closes verified pilot blockers. It does not succeed merely by producing more branches, UI variants, screenshots, or generated code.

## Non-goals

- Do not relitigate Pathway B.
- Do not start broad Phase 5 or Phase 6 expansion.
- Do not implement dark mode.
- Do not implement natural-language palette binding.
- Do not add tracker templates before the core journey passes.
- Do not build speculative processing features before pilot evidence opens `PILOT-4b`.
- Do not run external paid pilots before `DESIGN-CONV-A` passes.
- Do not promote candidate branches to Done without reconciliation and verification.
- Do not allow multiple agents to edit the same branch.

## Model roles

| Model | Primary role | Appropriate work | Avoid |
| --- | --- | --- | --- |
| Grok 4.5 | Integration and correctness lead | Candidate reconciliation, contract decisions, saved-state correctness, cross-cutting export behaviour | Bulk cosmetic changes before contracts settle |
| Composer 2.5 | Sustained implementation lead | Bounded UI implementation, accessibility fixes, removal work, test-backed component changes | Making product decisions absent canonical guidance |
| GLM 5.2 | Independent verifier | Regression tests, branch review, accessibility checks, state-round-trip probes | Simultaneous implementation on an active author branch |

A model that authors a change must not be its sole reviewer.

## Global working rules

1. Start every work item from the current protected `main` or the merged dependency branch.
2. Record the starting SHA and canonical baseline commands.
3. Use one branch per tracker item.
4. Give every agent the relevant tracker row, dependencies, gates, non-goals, and expected evidence.
5. Preserve backend-reset and engine-boot contracts.
6. Compare all failures with the starting baseline.
7. Update the canonical tracker only when implementation and evidence justify a status transition.
8. Prefer reimplementation on current `main` over conflict-heavy historical merges when the retained behaviour is small.
9. No wave may begin before its declared dependency is merged.
10. Stop when a product-owner or representative-user decision is required.

## Stage 0 — Baseline and candidate map

### V0.1 Record the protected baseline

**Lead:** GLM 5.2  
**Goal:** establish a trustworthy pre-sprint reference.

Record:

- current `main` SHA;
- required CI checks and branch protection state;
- canonical local verification commands;
- current five-minute journey behaviour;
- known failures already present at baseline;
- branch and candidate refs named by `DESIGN-CONV`.

**Deliverable:** a concise evidence note attached to the R0 pull request.

### V0.2 Complete `DESIGN-CONV-R0`

**Lead:** Grok 4.5  
**Mode:** single-threaded  
**Goal:** reconcile approved convergence candidates against current `main`.

For each candidate B–I and Q5:

1. Identify its exact branch and commit range.
2. Summarise the intended retained behaviour.
3. Compare it with current architecture and backend-reset contracts.
4. Identify textual and semantic conflicts.
5. Classify it as:
   - clean merge;
   - partial transplant;
   - reimplement on current main;
   - reject as superseded.
6. Record dependencies and the safest integration order.
7. Verify every retained candidate against the current baseline.
8. Do not silently mark any candidate Done.

**Required output:**

- candidate inventory;
- conflict matrix;
- retained/rejected decision for every candidate;
- ordered integration sequence;
- verification record;
- canonical tracker update.

**Exit gate:**

- every candidate has an explicit disposition;
- current `main` remains green;
- backend-reset behaviour is preserved;
- later branches have one stable integration baseline.

No Wave 1 implementation begins before R0 merges.

## Stage 1 — Pilot-blocking correctness

Run the following as separate branches from the merged R0 baseline.

### V1.1 `DESIGN-CONV-K1` — canonical palette grammar

**Lead:** Grok 4.5

Choose and implement one rows/columns contract across:

- palette labels and controls;
- help and inline copy;
- one-time teaching behaviour;
- five-minute automation;
- recipe representation;
- tests and assertions.

**Acceptance:**

- one vocabulary is used everywhere;
- automation asserts resulting analysis state, not click timing;
- no alternate grammar survives in help, tests, or stale UI;
- the decision is recorded in the canonical owner.

### V1.2 `DESIGN-CONV-K2` — slide-specific analytical state

**Lead:** Grok 4.5  
**Reviewer:** GLM 5.2

Restore and persist each slide's:

- weight;
- filters;
- analysis settings;
- view choice;
- recipe structure needed for reproduction.

Expose persistent summaries in the rail or inspector where the user needs them.

**Acceptance:**

- switching slides restores the correct state;
- session export/import round-trips the state;
- no global analytical state leaks across slides;
- agent-imported and human-created slides follow the same contract;
- malformed or unresolved state degrades explicitly.

This is the highest-risk correctness item. Do not combine it with visual redesign.

### V1.3 `DESIGN-CONV-K3` — interaction and accessibility closure

**Lead:** Composer 2.5  
**Reviewer:** GLM 5.2

Fix only the recorded blockers:

- overflow-menu hit testing;
- closed inspector content remaining focusable;
- contrast violations;
- slide-title typography mismatch;
- fixed-width layout risks.

**Acceptance:**

- pointer interactions work without force-click;
- closed controls are inert or unmounted;
- keyboard order and visible focus pass;
- contrast evidence is recorded;
- screenshots cover the agreed widths;
- no unrelated restyle.

### V1.4 `DESIGN-CONV-Q5` — retire focus mode

**Lead:** Composer 2.5

Remove:

- focus-mode controls and shortcut;
- mode-specific chrome rules;
- obsolete state and tests;
- documentation suggesting it remains supported.

**Acceptance:**

- default canvas is the sole presentation surface;
- no dead state or hidden shortcut remains;
- the core journey and export path remain green.

### V1.5 `DESIGN-CONV-B` — review-before-export lane

**Lead:** Composer 2.5  
**Correctness review:** Grok 4.5  
**Regression review:** GLM 5.2

Implement a required export review step containing:

- export-bound slide thumbnails;
- slide recipe summary;
- weights, filters and view state;
- unresolved-variable warnings;
- significance audit and limitations;
- explicit PPTX download action.

**Acceptance:**

- direct download cannot bypass review;
- human and agent-built sessions use the same lane;
- preview reflects the exact export payload;
- correction returns to the relevant slide without losing state;
- E2E proves review precedes download.

## Stage 2 — Journey convergence

Begin only after K1, K2, K3, B and Q5 are merged.

### V2.1 Discovery strip — `DESIGN-CONV-C`

**Lead:** Composer 2.5

Reconcile the thin recent-and-pinned variable strip. Retain it only if it improves discovery without recreating a full sidebar.

### V2.2 One-time palette ghost — `DESIGN-CONV-D`

**Lead:** Composer 2.5

Teach the final K1 grammar once, inline. It must dismiss permanently and must not become a tour overlay.

### V2.3 Collapsible story rail — `DESIGN-CONV-G`

**Lead:** Composer 2.5

Prove predictable collapse and expansion at one and five slides, including keyboard behaviour.

### V2.4 Post-upload continuity — `DESIGN-CONV-H`

**Lead:** Composer 2.5

After upload, land on slide 1 with the insertion path ready. Journey automation must assert the resulting analysis state.

### V2.5 Imported-session summary — `DESIGN-CONV-I`

**Lead:** Grok 4.5

Show slides added, unresolved variables, and recipe changes without introducing a new agent-management surface.

## Stage 3 — Final evidence gate

### `DESIGN-CONV-A`

Models may prepare:

- reproducible five-minute journey automation;
- current-main screenshots;
- accessibility and responsive probes;
- session protocol;
- structured score sheets;
- evidence collation.

Models must not fabricate representative-user evidence.

Run 3–5 unscripted sessions on the final candidate and record:

- completion time;
- discovery failures;
- incorrect assumptions;
- errors;
- recovery behaviour;
- export-review comprehension;
- state or trust concerns.

After any session-driven correction, rerun the complete evidence pack.

**Exit:** explicit pass, revise, or reject decision. Only a pass opens external paid-pilot recruiting.

## Branch sequence

```text
main
└── DESIGN-CONV-R0
    ├── DESIGN-CONV-K1
    ├── DESIGN-CONV-K2
    ├── DESIGN-CONV-K3
    ├── DESIGN-CONV-Q5
    └── DESIGN-CONV-B
         └── merged Wave 1 baseline
             ├── DESIGN-CONV-C
             ├── DESIGN-CONV-D
             ├── DESIGN-CONV-G
             ├── DESIGN-CONV-H
             └── DESIGN-CONV-I
                  └── DESIGN-CONV-A
```

Parallel branches may start from the same wave baseline only when they do not edit the same contracts or files. Resolve overlap by sequencing, not by asking agents to merge each other's speculative work.

## Suggested agent prompt contract

Every implementation prompt should include:

- tracker ID and exact outcome;
- dependency SHA;
- relevant canonical documents;
- allowed files or subsystem;
- explicit non-goals;
- required baseline and final commands;
- acceptance criteria;
- instruction to preserve unrelated work;
- required final report: files, behaviour, tests, risks, decisions.

## Sprint priority if capacity expires early

1. R0 reconciliation.
2. K2 saved-state correctness.
3. K1 palette contract.
4. B export review lane.
5. K3 accessibility and responsive closure.
6. Q5 focus-mode removal.
7. Journey-convergence candidates.
8. Evidence preparation.

A clean R0 plus one verified correctness fix is more valuable than several unresolved candidate branches.

## Completion record

When this sprint ends, add:

- merged PRs and SHAs;
- rejected or deferred work;
- verification evidence;
- known remaining blockers;
- recommended next pull;
- whether `DESIGN-CONV-A` is still blocked.

Then update `docs/tracker_00_implementation_status.md` and, if narrative changed, `docs/roadmap_00_strategic_guide.md`.
