# PILOT-0: SAV-to-Deck Pilot Brief

**Status:** Done (June 2026)  
**Source:** `docs/velocity_external_market_assessment.pdf`, `docs/tracker_00_implementation_status.md` §4.1  
**Gates:** Architecture (A) — conditional pass; Market validation (V) — aligned with external assessment

---

## Product thesis

The fastest, simplest, and most private path from an **analysis-ready SAV file** to a **defensible, editable client deck**.

**Beachhead ICP:** Boutique quantitative agencies and independent consultants who receive `.sav` files, produce editable client decks, run frequent crosstabs/subgroup cuts/tracker updates, and feel incumbent license/training friction.

**Positioning:** Win one high-frequency workflow — not broad SPSS/Displayr replacement. SPSS remains a complement for deep prep and advanced methods.

---

## Target workflow

| Step | Target | Measurement |
| :--- | :--- | :--- |
| Load analysis-ready SAV | Data on canvas, variables searchable | T1 − T0 (file selected → canvas ready) |
| Useful crosstab | Correct labels, weights, bases, significance | **< 5 min** (T2 − T0) |
| Acceptable editable slide | Native PPTX table/chart, minor touch-up only | **< 15 min** (T3 − T0) |
| Not rebuilt from scratch | ≥ 80% of slide content usable as exported | Post-task rubric (PILOT-6) |

**Qualified file profile (pilot cohort):** ≤ ~50 MB, ≤ ~500 variables, weights pre-applied if required, modern Chromium/Safari, single browser tab, OPFS available.

**Architecture validation (gate A):** Core path is shipped — SAV ingest, apply-existing-weights crosstabs, significance, editable PPTX export, workspace reopen. Conditional on scoping to Velocity-generated decks, not client template automation (PILOT-3).

---

## In scope (pilot promise)

- Local-first `.sav` / CSV ingest; data never uploaded to a server
- Searchable variables, grids, filters, recoding/bucketing
- Weighted crosstabs with automatic significance (apply existing weights only)
- Multi-slide Analysis Canvas; editable PPTX/XLSX export
- Durable workspace reopen on the same machine (OPFS)
- Portable `.velocity` session handoff (metadata + deck, no respondent rows)

## Out of scope (explicit non-goals)

- Weight creation, raking, or RIM
- Client PowerPoint template import, saved slide recipes, or wave-in-place deck refresh (PILOT-3)
- Broad SPSS replacement, enterprise collaboration, direct survey-platform imports
- General-purpose AI; agent as unsupervised analyst (PILOT-5 packages bounded outcomes later)
- Advanced methods (mixed effects, MaxDiff, conjoint), WebR, cloud/team governance
- Full data-processing layer (nets, banner plans, reshaping) — observe blockers in PILOT-4a before building

---

## Success metrics (PILOT-6 validation)

**Primary (per qualified project):**

- ≥ 70% of pilots achieve useful crosstab in < 5 min
- ≥ 70% achieve downloadable editable slide in < 15 min
- ≥ 60% rate exported PPTX ≥ 4/5 on acceptability
- ≤ 1 P1-blocking incident per participant (silent query failure, OPFS lock, etc.)

**Commercial (cohort of 5–8 paid pilots):**

- ≥ 5 of 8 pay and request continued access after pilot period
- Observed time reduction vs incumbent workflow without increased correction burden
- Documented willingness-to-pay signal against pricing hypotheses below

**Trust claims safe today (engineering-backed):** See [`docs/pilot_02_trust_pack.md`](pilot_02_trust_pack.md) — CI golden tests, R `survey` parity on `sleep.sav` and `bsa93.sav`, SPSS-style weighted mean/ESS fixtures, adapter parity, SAV benchmarks.

---

## Paid-pilot qualification screen (8 criteria)

Use as go/no-go for PILOT-6 recruiting:

1. **Workflow frequency** — SAV → client deck ≥ monthly; turnaround pain is material
2. **Deliverable type** — Primary output is editable branded PPTX, not dashboards-only
3. **Data handoff** — Receives `.sav` files (ideally analysis-ready or bounded prep gap)
4. **Team shape** — ≤ 15 analysts or solo; processing handoff is a documented bottleneck
5. **Incumbent friction** — Uses or evaluates Q / Displayr / SPSS; cites ~$3k/yr license or training burden
6. **Privacy trigger** — Upload blocks, security review, or confidentiality requirements favor local-first
7. **Technical fit** — Typical files within browser limits; accepts documented caps with warnings
8. **Commercial commitment** — Pays for pilot; commits to 2–4 observed real projects + workflow comparison

**Disqualifiers:** Enterprise procurement/SSO; academic-only use; advanced modelling as core job; generic AI experimenters with no survey deliverable need.

---

## Pricing hypotheses (WTP testing)

Anchored below incumbents (Q ~€2,819/yr; Displayr Professional ~$3,359/yr):

| Model | Indicative range | Test in pilot |
| :--- | :--- | :--- |
| **Solo annual seat** | $1,200–1,800/yr | Retention intent post-pilot |
| **Monthly self-serve** | $99–149/mo | Freelancer / sporadic use |
| **Per-project / tracker** | $300–600/study or $800–1,200/yr per active tracker | Lumpy project flow |

**Pilot fee:** $500–1,500 for 60–90 day paid pilot, credited toward annual if converting.

---

## Messaging guardrails

**Do:** Lead with Friday-4pm deck job; simplicity vs incumbent menus; defensible bases/weights/tests; privacy when it removes a real blocker; timed workflow proof once instrumented.

**Don't:** Claim "Anti-SPSS" or full replacement; category novelty on local-first AI; MCP/tool counts; template-linked wave refresh until PILOT-3; weight creation or advanced methods; free unlimited pilots.

---

## Unblocks (parallel work after PILOT-0)

| ID | Workstream |
| :--- | :--- |
| PILOT-1 | ~~Deployable build~~ Done — [`pilot_01_packaging.md`](pilot_01_packaging.md) |
| PILOT-2 | [`docs/pilot_02_trust_pack.md`](pilot_02_trust_pack.md) — published |
| PILOT-4a | Processing gap discovery on real pilot files |
| PILOT-6 | Paid pilot recruiting (promise must match in-scope table above) |

---

## Validation evidence (June 2026)

Sub-agent audits against codebase and market assessment:

- **Architecture (A):** Conditional pass — core wedge shipped; template loop and weight creation deferred with honest boundaries (`docs/completed_foundations_summary.md`, `docs/blue_02_feature_matrix.md`)
- **Workflow timing:** Achievable on qualified path with PILOT-1 polish; human wall-clock and PPTX acceptability unproven until PILOT-6
- **Market alignment:** Thesis, ICP, non-goals, and tension responses aligned with external assessment
- **Trust readiness:** Buyer-facing pack published in `pilot_02_trust_pack.md` (June 2026); WVS browser WASM parity and real-SAV coded-missing goldens remain gaps
