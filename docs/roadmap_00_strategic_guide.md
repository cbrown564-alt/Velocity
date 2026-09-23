# Velocity Strategic Guide

This document owns product direction. [The workstream tracker](tracker_00_implementation_status.md) owns current priorities and status. Architecture and design documents own their respective contracts.

## Purpose

Build a survey-native research workbench that helps a researcher move from a survey file and brief to a defensible, editable answer. Models may interpret and propose; Velocity computes; the researcher controls methodological and editorial decisions. The first commercial use remains a plausible direction, not a schedule or a requirement to recruit researchers now.

The product is in internal development. The product owner is the research tester and decides when it is viable for other researchers. Until then, work proceeds through direct use, focused experiments, and complete prototypes. No external-session count, paid pilot, or formal approval milestone is needed to choose or continue a workstream.

## How to progress

1. **Make the existing journey reliable.** A file should open, analyses should be inspectable, saved work should reopen faithfully, and the exported material should be editable and worth reviewing.
2. **Test research quality on consequential tasks.** Synthetic and public studies should expose failures in preparation, analysis, selection, interpretation, and revision. Independent calculations and direct researcher judgment serve different purposes. More studies are useful only when they reveal a new failure mode.
3. **Build one assisted workflow inside Velocity.** Connect a brief, supported engine analyses, evidence-linked findings, researcher edits, saved state, and a usable answer in the existing workspace. Keep the first implementation narrow enough to experience and revise.
4. **Expand where the workflow needs it.** Add preparation methods, specialist statistics, presentation capabilities, or model techniques in response to a demonstrated limitation. Preserve the architectural and statistical invariants in `AGENTS.md`.

The tracks can overlap. This order is a guide to attention, not a dependency graph. A small experiment may run whenever it answers a concrete product question.

## Current facts and limits

- The engine, MCP interface, survey statistics, provenance, session interchange, and editable export foundations exist. They do not by themselves provide a unified assisted research experience.
- Design convergence has verified candidate work outside `main`; the final integrated journey and its presentation quality still need direct inspection and correction.
- Research quality studies have exposed omissions in narrative selection. Their experimental results do not establish product viability or measured researcher time savings.
- The pilot and representative-session plans written in June and July 2026 are historical preparations. They do not control present development. External testing and commercial work resume only if the product owner chooses them.
- WebR, broad processing, fine-tuning, and cloud collaboration are possible future capabilities, not locked phases or obligations.

## Decision practice

For a proposed workstream, state the user task, the smallest complete result that would answer the question, and what current evidence says. Build and inspect that result. Record a decision to continue, change, or stop it in the tracker. Do not add a new approval process or claim that a prototype has been validated by external users.

Existing automated checks remain part of implementation verification. Statistical meaning, dual-state data, worker compute, engine boundaries, and session compatibility remain governed by `AGENTS.md` and the architecture owners.
