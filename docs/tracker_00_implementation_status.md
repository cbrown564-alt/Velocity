# Velocity Workstream Tracker

This is the current list of product work. It records what is being built, what is being explored, and what is parked. It is not a release checklist or a sequence of approval gates. Historical plans and audits remain evidence, not instructions to resume their processes.

## Current working arrangement

- Velocity is in internal development. The product owner is the research tester and will decide when the product is viable for other researchers. No external researcher sessions, paid pilot, fixed session count, or commercial readout is required to continue product work.
- Build one complete, inspectable workflow at a time. Use the product directly, record defects and decisions, and improve it. A benchmark result or a working prototype is evidence about that slice, not a claim that the whole product is ready.
- Keep code checks and architectural invariants. They verify changes; they do not decide product direction. Use focused checks during development, `npm run ci` before broad completion claims, and `npm run test:e2e` when browser journeys change, as `AGENTS.md` requires.
- The product owner may change priorities as the product becomes clearer. No workstream needs a pilot result or formal approval milestone before it can be explored or prototyped.

## Current work

| Priority | Workstream | Current position | Next useful result |
| :--- | :--- | :--- | :--- |
| 1 | **Existing researcher journey** | The design-reset foundation, saved-slide settings, palette grammar, and export preview are on `main`. One active analysis now resolves consistently for run, session save/reopen, export review, and XLSX output; focused and browser checks pass. The retained discovery, onboarding, rail, upload handoff, and import-summary candidates have local verification on `codex/convergence-candidates`, but are not on `main`. | Test this saved-analysis loop directly in the app, then review the convergence candidates with the product owner, keep the useful parts, and capture current journey screenshots. |
| 2 | **Research quality and assisted interpretation** | Corrected SBT-001 and frozen SBT-002/003 support a ten-output, one-model pilot with explicit scoring, a blinded review prototype, and a bounded native-deck adapter. Independent researcher assessments and measured correction burden remain unavailable. This is experimental evidence, not a released product feature. | Resolve reference/scorer ambiguities and use one supported study to test whether findings and counter-evidence survive into a useful answer. Keep the study portfolio as a way to find failures, not a feature list. |
| 3 | **One unified workflow prototype** | Engine analysis, provenance, sessions, and editable export exist. Evidence-linked findings and researcher review are not yet one durable workflow in the app. | Design the smallest session-compatible evidence/finding/review state, then build one loop: open a file and brief, run supported analyses, inspect and revise a proposed finding, save, reopen, and continue. The product owner tests it. |
| 4 | **Reporting quality** | Editable PPTX and the review-before-download lane exist. A technically editable export is not yet proof of a strong client presentation. | Inspect exported slides directly and improve the specific defects found in the representative workflow. Preserve the link between claims and their evidence. |
| 5 | **Preparation gaps** | Internal examples expose some processing gaps; the former `PILOT-4a` kit was written for external pilot discovery. | Keep a short list of blockers found while testing real or realistic files. Add only the preparation operation needed to complete the selected workflow, with replay and dual-state integrity checks. |

These priorities describe where to spend attention now. They are not dependencies: useful design, research, and prototype work can proceed when it helps answer a concrete question.

## Parked work

| Work | Reason to revisit |
| :--- | :--- |
| Paid pilot programme and external researcher recruitment | The product owner decides when Velocity is viable for other researchers. Existing outreach and evidence kits are historical preparation only. |
| Broad Phase 5–7 expansion: WebR, advanced models, full processing, cloud collaboration, platform imports | Revisit a specific capability when a current workflow needs it. Prefer the smallest supported implementation. |
| Fine-tuning and a large synthetic-study portfolio | Revisit when simpler changes to study semantics, tools, evidence contracts, or completeness checks fail on a meaningful task. |
| Dark mode, natural-language palette binding, three-slide starter template, and other optional UI additions | Revisit when direct product testing shows they improve the current workflow. |
| CI coverage ratchets beyond current checks | Maintain truthful existing checks; raise thresholds when the relevant code or tests are being improved. |

## What is already established

Completed foundations, benchmark results, and historical implementation IDs are summarized in [completed foundations](completed_foundations_summary.md). The [design-reset plan](plan_05_design_reset_implementation.md), [July boot/CI audit](audit_10_engine_boot_ci_truth_rca_2026-07-14.md), and [research quality strategy](workstreams/research_quality/00_strategy.md) retain detail for their respective work. `docs/archive/` remains historical evidence.

The former `DESIGN-CONV-A` external-session requirement and `PILOT-6`/`PILOT-7` programme no longer control the roadmap. Their documents may be used as references if the product owner later chooses external testing or commercial work.

## Keeping this tracker useful

Update the relevant row when the actual work or evidence changes. Record the next concrete result and link to the source code, test, screenshot, or research artifact that supports a completion claim. Do not add a new process stage, approval gate, or parallel status board for ordinary product work.
