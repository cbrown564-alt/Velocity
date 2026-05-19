---
name: agent-eval-run
description: Use when planning, running, scoring, or interpreting agent capability evals. Follow eval_framework gap classification and preserve frozen evals/ artifacts.
---

# Agent Eval Run

Use this skill when eval work moves from idea → run → interpretation → product decision. An eval is only useful if its outcome changes what Velocity builds next.

## Required Reading

1. `docs/eval_framework.md` — scoring rubric and outcome patterns
2. `evals/README.md` — artifact layout and frozen-run rules
3. `docs/eval_00_run_summary_schema.ts` — `summary.json` shape
4. The relevant `evals/eval-NN/brief.md` for the benchmark in scope

## Workflow

1. Identify the eval ID, hypothesis, and decision question (what layer might fail? what would we build next?).
2. Confirm the brief and acceptance criteria before running.
3. Prefer repro scripts under `evals/eval-NN/scripts/` when they exist.
4. Run with explicit scope:
   - dry/capped pass when changing harness, prompts, tools, or engine surface
   - full run only after contracts are stable
5. Write artifacts to the eval's `runs/` folder using project templates (`evals/templates/`).
6. Score using `eval_framework.md`:
   - locate the bottleneck layer (engine, MCP/workflow, semantic, browser convergence, deliverable, product defaults, agent prompting)
   - classify gaps; do not mix "rough edge" with "capability gap" without evidence
7. Record the decision: continue, fix, re-scope, or defer — tied to tracker/roadmap items when applicable.

## Anti-Patterns

- comparing metrics across runs with different scorer or tool contracts without noting the caveat
- treating a pretty export as success when analysis correctness failed
- expanding eval scope mid-run without updating the brief
- citing archive Phase 4 docs as current mandate when `eval_framework.md` and tracker supersede them

## Completion Criteria

Before finishing, summarize:

- eval ID and decision question
- run artifact paths
- layer diagnosis and gap classification
- recommended next product/engine/docs action
