# Research Quality Backbone

**Status (22 September 2026):** Experimental workstream. Corrected SBT-001 is merged; SBT-002–006 are frozen. The original ten-output pilot and the GPT-6 Pro authored three-study expansion have preserved model evidence, explicit provisional adjudication and deterministic selection scores. Separate blinded review packs and bounded native-deck adapters are implemented. Independent researcher assessments, measured correction burden and product promotion remain pending. Current evidence: [original pilot](../../../evals/research_quality/runs/2026-09-pilot-comparison/readout.md) and [expansion](../../../evals/research_quality/runs/2026-09-expansion-comparison/readout.md).
**Current use:** Research tests may inform internal product work, but this strategy does not impose external researcher sessions, a pilot readout, or a formal product promotion sequence. The product owner is the research tester until they choose otherwise. Current priorities live in the [workstream tracker](../../tracker_00_implementation_status.md).
**Wedge:** Brand-tracker preparation -> analysis -> publication-quality editable deck  
**Principle:** Models interpret, propose and communicate. Velocity computes. Publication requires verified evidence.

## 1. Goal

Build an evaluation-first research programme that can answer a concrete question before model fine-tuning begins:

> Can an AI-assisted Velocity workflow turn an unfamiliar tracker wave plus its questionnaire/documentation into a defensible, editable, publication-quality client deck with less researcher correction than strong general-purpose AI and the existing Velocity baseline?

The workstream is deliberately broader than crosstab accuracy. It evaluates three linked capabilities:

1. **Prepare** — understand survey structure and propose trustworthy processing decisions.
2. **Analyse** — convert a research brief into appropriate, executable survey analyses and supported findings.
3. **Communicate** — turn verified findings into a coherent, attractive, steerable research deck.

The initial target is not autonomy. It is a demonstrably better researcher-in-the-loop workflow for boutique agencies.

## 2. Data strategy

Use three evidence tiers and keep provenance/licensing explicit.

### Tier A — public real surveys

Preferred sources are surveys that provide microdata plus rich documentation and, ideally, expert-written reports whose findings can be reproduced.

**High-priority sources**

- **Pew Research Center American Trends Panel** — many public waves, questionnaires, toplines, methodology and reports; particularly useful for media/technology/brand-like grids. Wave 165 (2025) covers media brands and social trust. Pew data requires account/terms review; do not assume every ATP dataset has the same downstream training rights.
- **ANES** — SPSS/CSV/Stata files, questionnaires, codebooks, release-variable lists and a long time series. Strong for documentation-heavy analysis and repeated-wave tests.
- **GSS** — long-running survey data with SPSS downloads and extensive documentation; useful for trend, weighting and variable-discovery tasks.
- **European Social Survey** — repeated cross-national rounds with extensive documentation. Data are CC BY-NC-SA 4.0, so treat as non-commercial research/evaluation material unless licensing changes.
- **UK Data Service** — rich UK survey catalogue including British Social Attitudes, Understanding Society and government surveys. Access and commercial-use rights vary by collection; record licence at dataset level.
- **World Values Survey** — rich cross-national/time-series material, but public data conditions specify non-profit use and prohibit redistribution. Keep outside any commercial training corpus unless permission is obtained.
- **U.S. government surveys / LongDA sources** — LongDA already packages 505 expert-grounded analytical queries over 17 national surveys and is an excellent external benchmark pattern for documentation-intensive survey analysis. Follow each underlying dataset's terms.

### Tier B — public consumer/brand proxies

- **BRAND (Brand Recognition and Attitude Norms Database)** — 2,000 U.S. consumers, 2020 and 2024, 500+ brands across 32 industries, with familiarity/awareness, liking and recognition. Useful for brand semantics and time comparison.
- **UK Food Standards Agency Consumer Insights Tracker** — monthly tracker, currently administered by YouGov, with repeated attitudes/behaviours and OGL-published tables. Useful as a real tracker structure even when respondent-level microdata are unavailable.
- **Other government consumer surveys under OGL/open licences** — useful for weighted tables, trend stories and report reconstruction.
- **Kaggle survey datasets** — use selectively as stress/proxy data, not gold truth. Examples exist for customer satisfaction, customer surveys and brand preference, but provenance/licensing and survey design quality are inconsistent. Unknown-licence datasets must not enter a training corpus.

### Tier C — synthetic brand trackers

Synthetic data should be generated from an explicit survey/data-generating specification, not by asking an LLM to invent a CSV. Synthetic cases are valuable because every intended relationship, break, missingness rule, routing rule and wave change can be known exactly.

Create families of synthetic projects rather than one canonical demo:

- categories: telecoms, banking, grocery/FMCG, travel, streaming, consumer tech;
- 4-8 brands, including a market leader, challenger, niche brand and declining incumbent;
- 4-8 waves with stable core questionnaire plus controlled questionnaire drift;
- awareness -> familiarity -> consideration -> usage/preference funnel;
- brand attributes, NPS/recommendation, ad awareness, campaign recall, satisfaction;
- demographics, segments, weights, quotas and low-base groups;
- multi-response questions, grids, routing, structural missingness, DK/refused, nets and derived variables;
- planted changes: genuine shifts, flat metrics, composition-driven apparent shifts, low-base false excitement, multiple-comparison traps and changed question wording;
- a hidden truth manifest recording every planted effect and every valid/invalid inference.

Synthetic projects should include raw export, analysis-ready reference file, questionnaire, codebook, processing spec, research brief, verified analysis outputs, approved finding inventory and one or more expert-quality deck references.

## 3. Licensing and contamination policy

Every dataset gets a `data_card` before use. Minimum fields:

- source and exact version/date;
- download URL and retrieval date;
- licence/terms URL;
- allowed purposes: evaluation, non-commercial research, commercial prototype, model training, redistribution;
- attribution requirements;
- respondent-level restrictions;
- whether raw data may be committed to the repository;
- whether derived labels/trajectories may be retained;
- train/dev/eval allocation.

**Hard rule:** evaluation-only material never migrates into training data. Keep an immutable holdout registry and hash source artifacts. Do not train on benchmark questions, reference decks, hidden truth manifests or expert holdout corrections.

Pew is promising but must be handled carefully: its general survey-dataset terms permit broad derivative use with attribution, while American Trends Panel datasets are explicitly governed by their own terms. Confirm the ATP terms applicable to each downloaded wave before using it for fine-tuning or commercial prototype training.

## 4. Benchmark architecture

The benchmark is a **project bundle**, not a row-level dataset.

Each project should resemble what a boutique researcher receives:

```text
project/
  manifest.json
  brief.md
  questionnaire.pdf|md
  codebook.*
  raw/
    wave_*.sav|csv
  reference/
    processing_recipe.json
    analysis_plan.json
    findings.jsonl
    deck_spec.json
    deck.pptx
    rendered_slides/
  hidden/
    truth.json
    grader_config.json
```

A project can expose different inputs for different eval tracks while sharing one hidden truth.

## 5. Evaluation tracks

### E1 — Survey interpretation

Input: raw file metadata + questionnaire/codebook.  
Output: structured variable annotations and proposed preparation recipe.

Score deterministically where possible:

- question/grid/multi-response grouping F1;
- weight identification;
- routing/eligibility interpretation;
- missing-value semantics;
- scale direction/type;
- derived/net proposal precision/recall;
- unsafe transformation count;
- evidence/source-span correctness.

### E2 — Preparation execution

Input: E1 proposal or gold processing spec.  
Output: analysis-ready dataset + transformation log.

Score:

- exact/semantic schema match;
- respondent/case preservation;
- derived-variable agreement;
- missingness/routing invariants;
- weight integrity;
- replay on next wave;
- forbidden mutation checks.

### E3 — Brief-to-analysis plan

Input: research brief + prepared data + documentation.  
Output: typed analysis plan.

Score:

- correct universe/base;
- correct variables/measures;
- correct breaks/segments;
- correct weight;
- planned comparison validity;
- required analysis coverage;
- unnecessary-analysis rate;
- low-base/multiple-comparison safeguards.

### E4 — Numerical analysis and finding inventory

Input: approved analysis plan.  
Output: computed results + structured findings.

Numbers are graded by code, not by an LLM judge. Score:

- parity with reference calculations;
- significance/interval correctness;
- denominator/base correctness;
- claim-evidence consistency;
- unsupported finding rate;
- omission of material planted findings;
- false-positive excitement on planted traps.

### E5 — Story selection

Input: verified finding inventory + client brief.  
Output: proposed story hierarchy and deck outline.

This is where 'taste' starts. Use expert pairwise preference and rubric-based grading. Criteria:

- materiality;
- client relevance;
- prioritisation;
- restraint;
- narrative coherence;
- distinction between evidence and interpretation;
- avoidance of mechanical 'one slide per question' behaviour.

### E6 — Deck generation

Input: approved findings/story + brand/template constraints.  
Output: editable PPTX and rendered slides.

Separate objective checks from subjective quality:

**Deterministic:** numbers, labels, bases, citations, overflow, clipping, overlap, missing required elements, editability, template/token compliance.  
**Expert preference:** hierarchy, density, visual emphasis, headline quality, chart choice, whitespace, coherence, elegance and client readiness.

Use pairwise comparisons for taste rather than relying primarily on 1-10 scores. Recent visual-aesthetic research finds direct comparative judgments more reliable than scalar scoring; multimodal judges should be calibrated against expert researcher preferences rather than assumed correct.

### E7 — Steerability and revision

Input: deck + realistic client/researcher change request.  
Output: revised deck.

Test requests such as:

- 'Make this less salesy and more evidence-led.'
- 'Lead with the competitor threat, but don't overstate the significance.'
- 'Use our standard funnel slide and keep all existing numbers.'
- 'Cut this to 8 slides for the board.'
- 'The client hates pie charts.'
- 'Wave 5 has arrived; update only what changed and flag claims needing review.'

Score instruction adherence, invariant preservation, unnecessary-change rate and time/cost to accepted revision.

### E8 — End-to-end researcher outcome

The north-star eval. Give the system the project bundle available to a researcher and measure:

- elapsed time to first reviewable deck;
- researcher active minutes to approval;
- number and severity of corrections;
- final factual defect count;
- final taste/preference score;
- steerability turns to acceptance;
- compute/API cost;
- reproducibility on rerun.

## 6. Grading hierarchy

Use graders in this order:

1. **Execution/code checks** for anything objectively verifiable.
2. **Reference comparison** for known transformations, analyses and findings.
3. **Expert pairwise judgement** for taste, prioritisation and client readiness.
4. **Calibrated LLM/MLLM judges** only to scale subjective grading after agreement with expert labels is measured.

Do not collapse the benchmark into one score. Publish a scorecard with hard gates plus dimensions. A beautiful wrong deck fails. A correct but mechanical deck can pass trust gates while failing the product-quality bar.

## 7. Comparative baselines

Run the same project bundles through:

- **B0:** current Velocity heuristics/templates;
- **B1:** strong general model with raw files only;
- **B2:** strong general model + Velocity tools/contracts;
- **B3:** public specialist data-analysis model where feasible;
- **B4:** presentation-specialist model/agent where feasible;
- **B5:** future Velocity fine-tune(s).

The comparison should isolate where value comes from: base-model intelligence, tool scaffolding, survey-specific training, report-specific training, or the deterministic engine.

## 8. Data flywheel

Do not fine-tune first. Build the eval harness and collect corrections first.

For every run capture:

- model/system/version and prompt/config;
- full tool trajectory;
- proposed decisions;
- deterministic grader outputs;
- researcher accept/edit/reject action;
- structured correction and reason;
- before/after deck artifacts;
- pairwise preference labels;
- latency and cost.

Promote examples into training only after review. Prefer high-information examples: mistakes, disagreements, difficult routing, subtle bases, strong deck edits and steerability corrections. Avoid flooding training with easy synthetic cases.

## 9. Prototype sequence

### Phase 0 — Harness first

- implement bundle manifest and immutable split registry;
- add deterministic graders for prep/analysis/deck integrity;
- create expert taste rubric and pairwise review format;
- support repeated runs and model/config comparison;
- store run traces and artifacts.

Exit: one command can evaluate multiple systems on the same frozen projects and emit a comparable scorecard.

### Phase 1 — Public-survey reality set

Curate 8-12 projects from public surveys. Start with sources that include raw data, documentation and an expert publication so reference analytical questions can be reconstructed. LongDA is the design precedent: expert publications define realistic tasks while agents only receive raw data/documentation.

Exit: at least 50-100 grounded preparation/analysis tasks across multiple survey families, with no synthetic-only success path.

### Phase 2 — Synthetic tracker factory

Generate 20-30 synthetic brand-tracker projects across categories and difficulty tiers. Reserve entire generator seeds/templates as hidden test families.

Exit: hundreds of controlled tasks plus at least 20 end-to-end tracker bundles with known truth and failure traps.

### Phase 3 — Taste set

Create 10-20 reference decks from a smaller subset of projects. Produce intentionally mechanical, over-designed, misleading and excellent variants. Have experienced researchers perform pairwise ranking and short critiques.

Exit: a researcher-grounded preference set that can evaluate story and visual quality separately from correctness.

### Phase 4 — Baseline tournament

Run B0-B4. Perform failure taxonomy analysis before training.

Exit: evidence identifying which behaviours actually require task-specific learning.

### Phase 5 — Fine-tune narrowly

First candidate: survey interpretation/preparation proposal model.  
Second candidate: story/deck planner or visual critic.  
Keep deterministic analysis outside the model.

Train on accepted/corrected trajectories plus controlled synthetic augmentation. Keep project-level holdouts immutable.

### Phase 6 — Boutique-agency demo

Prepare three polished demonstrations:

1. unfamiliar tracker -> trustworthy preparation review;
2. brief -> verified analysis -> publication-quality first deck;
3. next wave -> preserved recipe -> changed story -> steerable deck revision.

The demo should expose provenance and corrections rather than hide them. The claim is not 'fully autonomous research'; it is 'a high-taste research copilot that makes the researcher dramatically faster without surrendering methodological control.'

## 10. Prototype acceptance bar

Do not invite agencies until the hidden evaluation set shows:

- zero known fabricated numerical claims in accepted decks;
- zero silent wrong-base/weight errors in the demo set;
- deterministic deck-integrity checks pass;
- tracker recipe replay succeeds on the chosen demo projects;
- strong general-model baseline is materially improved on researcher correction burden;
- expert pairwise preference favours the Velocity output over a deliberately mechanical baseline on story and visual quality;
- realistic steerability requests preserve locked numbers and evidence;
- an unfamiliar held-out project can reach client-ready state with a plausible boutique-agency review burden.

## 11. Current decision and next evidence

The September pilot motivated a coverage-check experiment before fine-tuning. Approved analyses yielded complete mandatory finding recovery in four of five repeated one-pass runs; both raw workflows omitted polarisation despite calculating the distributions. This is provisional agent adjudication, not researcher consensus.

The SBT-004–006 expansion now adds GPT-6 Pro authored usage-and-attitude, campaign and pricing studies, independently recomputed and frozen before model exposure. The [expansion readout](../../../evals/research_quality/runs/2026-09-expansion-comparison/readout.md) owns the study-level outcomes, numerical coverage, runtime failures and limitations. SBT-004's four workflows all retain digital polarisation but miss the same budget-support contrast; the original concept-test finding should not be generalised into a universal raw-data failure. The campaign and pricing studies each recover all mandatory propositions in their four completed outputs under provisional adjudication. These cases remain exposed development data, not hidden tests. They extend the offline reviewer-to-native-deck prototype; they do not establish independent researcher preference or product readiness.

The [capped second-pass comparison](../../../evals/research_quality/runs/2026-09-completeness-comparison/readout.md) is closed. Its scored SBT-004 pair shows that a general review and the structured checklist both recovered the missing mandatory contrast. SBT-005/006 drafts already had full mandatory recall, and one SBT-006 checklist call failed under the no-retry protocol. This evidence does not justify promoting the checklist or adding more development studies now.

1. Give the separate original and expansion blinded packs to the user's reviewers. Preserve independent baseline findings, original decisions, preference, active minutes and corrections before revealing identities.
2. Reconcile researcher disagreements with the frozen references; do not silently change v1. In a new study version, clarify the SBT-003 first-contact-resolution universe and align the raw/analysis information and inference methods.
3. Use one supported study to test whether verified findings, counter-evidence and researcher revisions survive into a useful answer. Compare more than one model/configuration only when this workflow exposes a consequential repeatable weakness. Current public FSA evidence covers nine published tables, not raw-survey preparation or unseen generalisation.
4. Use the verified review/export prototype as the representative slice for a future product change. Promotion needs workspace/session migration design, worker/engine boundaries, accessibility and product-journey checks, plus reviewer evidence that it reduces correction burden.
5. Decide on fine-tuning only if repeatable weaknesses survive better inputs, methods, coverage checks and workflow design. No training is authorised or performed by this pilot.

The broader phases above are targets, not completed deliverables. Registry entries label all exposed projects as development/evaluation-only; no untouched holdout is claimed.
