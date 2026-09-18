# TypeSafe Jev control plane (research quality)

## Role

TypeSafe **Jev** is the System One decision layer for Velocity's research-quality harness. It does **not** generate findings, story beats, recode expressions, or slides. An LLM or `VelocityEngine` still produces candidates and applies transforms; Jev classifies, scores, gates, and escalates with calibrated probabilities.

## Where it sits

```text
raw study / SAV
   → [optional] Jev cleaning gate  →  analysis-ready surface / recipe choice
   → analyst (LLM/engine)
   → Jev verifier gate
   → Jev prioritiser gate
   → story editor (LLM)
   → presentation boundary (out of scope for this benchmark)
```

Mapped to experiment arms:

| Arm / stage | Jev role |
| :--- | :--- |
| E2 verifier | Primary — estimand/universe/weight/routing support, hard-failure disposition |
| E2 prioritiser | Primary — tier choice, do-not-elevate restraint, redundancy gate |
| E4 → E3 path | Cleaning control plane — variable role, routing/missing semantics, recipe choice, readiness |
| E1 / story editor | Gate only — never sole producer of `model_research_output` |
| Adjudication assist | Optional — match/contradiction scores against frozen references *after* the run (scoring side; never in model context) |

## Contracts in-repo

| Artifact | Purpose |
| :--- | :--- |
| `evals/research_quality/jev/stage_roles.json` | Stage → question-pack binding |
| `evals/research_quality/jev/verifier_questions.json` | TypeSafe questions for finding/evidence candidates |
| `evals/research_quality/jev/cleaning_questions.json` | TypeSafe questions for raw-variable / analysis-readiness triage |
| `evals/research_quality/schemas/jev_gate_result.schema.json` | Structured gate output |
| `scripts/python/research_quality/jev_gate.py` | Offline validate + optional live `typesafe ask` |

## Live calls

Live Jev calls require `TYPESAFE_API_KEY` and the `typesafe` CLI. CI asserts **structure only** (packs + schema). Runtime gates remain execution tests, same pattern as generator/freeze validators.

## Exposure

Jev gates receive only allowlisted stage inputs (candidates + public study semantics, or variable metadata for cleaning). They must never receive `/hidden/`, trap truth, reference finding inventories, or scoring keys — same rules as `model_exposure_contract.json`.
