# PILOT-4a: Processing Gap Discovery Kit

**Status:** In progress (discovery kit prepared; external observation set not started)  
**Depends on:** `PILOT-0`  
**Feeds:** `PILOT-4b` scope and sequencing decisions

---

## 1. Purpose and guardrails

This kit standardizes how we observe real pilot files/projects to identify **true Friday-4pm blockers** before building processing features.

Rules:

- Record only observed evidence from real pilot runs.
- Keep pre-populated signals separate from observed pilot evidence.
- Do not propose implementation scope from single anecdotes.
- Preserve pilot scope discipline: **discover first, build second**.

Target sample size: **10-15 project/file reviews** (qualified pilot workflows).

---

## 2. Project/File Review Template (use per observation)

Copy this section once per reviewed project/file.

```md
### Review ID: P4A-###

**Date:** YYYY-MM-DD  
**Reviewer:**  
**Pilot participant/account:**  
**Project type:** ad hoc study | tracker wave | client refresh | other  
**File profile:** source format(s), approximate size, variable count, known weighting state  
**Workflow target:** What they needed to deliver by deadline

#### A) Context and expected output
- Client deliverable needed:
- Time pressure context:
- Existing incumbent workflow (SPSS/Q/Displayr/other):

#### B) Attempted workflow in Velocity
- Steps attempted:
- Point of failure or friction:
- Workaround used (if any):
- Did they finish on time? yes/no/partial

#### C) Candidate processing gaps observed
- Gap candidate(s):
- Trigger condition(s):
- Frequency signal in this account: one-off | occasional | recurring
- Evidence quality: direct observation | user report with artifact | user recollection

#### D) Blocker scoring inputs
- Frequency score (1-5):
- Severity score (1-5):
- Time impact score (1-5):
- Confidence score (1-5):
- Weighted blocker score (calculated):

#### E) Scope discipline capture
- Immediate "do not build yet" candidates from this review:
- Why not yet (insufficient frequency, out-of-ICP, high complexity, workaround exists):
- Explicit assumptions needing validation:

#### F) Artifacts and citations
- Pilot event log file:
- Session/export artifacts:
- Notes / transcript location:
```

---

## 3. Blocker taxonomy

Use one primary taxonomy tag per blocker, plus optional secondary tags.

| Taxonomy code | Category | Definition | Typical examples |
| :--- | :--- | :--- | :--- |
| `WT-CREATE` | Weight construction | Need to create/calibrate/rake weights, not just apply existing | RIM/raking setup, quota balancing |
| `NET-DERIVE` | Nets/derived variables | Need reusable derived variables or net groupings for routine tables | Top-box nets, composite segments |
| `BANNER-PLAN` | Banner/break planning | Need persistent subgroup plans reused across outputs | Standard banner definitions across deck |
| `RESHAPE` | Structural transforms | Need long/wide reshape or wave-merge transforms to analyze | Tracker wave append/stack |
| `RECIPE-REPLAY` | Repeatable processing recipes | Need repeatable, rerunnable preprocessing chain | Monthly tracker rerun recipes |
| `MISSING-CODES` | Missing-value coding prep | Need recoding/standardization of missing/coded values before analysis | Custom DK/REF coding cleanup |
| `META-HYGIENE` | Metadata alignment | Need variable label/value-label harmonization before analysis | Inconsistent labels across waves |
| `OTHER` | Out-of-band blocker | Any blocker outside expected categories | Client-specific edge prep |

---

## 4. Ranking rubric (frequency, severity, time impact)

Score each blocker candidate on 1-5 scales:

- **Frequency (F):** How often this blocker appears across reviewed projects.
- **Severity (S):** How strongly it blocks successful completion of the pilot workflow.
- **Time impact (T):** Additional time burden compared with target workflow.
- **Confidence (C):** Evidence quality/confidence in the score.

Scale anchors:

| Score | Frequency | Severity | Time impact | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 1 isolated case | Minor friction | <10 min | weak anecdote |
| 2 | 2 cases | Manageable with simple workaround | 10-30 min | partial evidence |
| 3 | 3-4 cases | Repeated friction; late-stage risk | 30-60 min | observed once directly |
| 4 | 5-7 cases | Frequent blocker; threatens delivery | 1-3 hours | multiple direct observations |
| 5 | 8+ cases | Systemic blocker; pilot promise breaks | >3 hours or failed delivery | strong repeated evidence |

Weighted blocker score:

`Weighted Score = (0.35 * F) + (0.35 * S) + (0.20 * T) + (0.10 * C)`

Decision bands for `PILOT-4b` input:

- **Build candidate now:** `>= 3.8` and at least 3 independent observations.
- **Monitor / gather more evidence:** `2.6 - 3.79`.
- **Do not build yet:** `< 2.6` or weak confidence.

---

## 5. Explicit “Do Not Build Yet” capture

Maintain this list continuously during discovery to avoid scope creep.

```md
## Do Not Build Yet Register

| Item | Why deferred now | What evidence would reverse decision | Last reviewed |
| :--- | :--- | :--- | :--- |
| Example: full raking UI | Not yet observed as recurring paid-pilot blocker | >=3 independent pilot projects blocked specifically by weight creation limits | YYYY-MM-DD |
```

---

## 6. Synthesis template for PILOT-4b scope decisions

Use this once the observation set reaches sufficient coverage.

```md
# PILOT-4a Synthesis (for PILOT-4b Scoping)

## Observation coverage
- Total project/file reviews completed:
- Distinct participants/accounts:
- Distinct workflow types represented:
- Evidence quality notes:

## Ranked blockers
| Rank | Taxonomy code | Blocker statement | F | S | T | C | Weighted score | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |

## Recommended minimum build slice (PILOT-4b candidate)
- In scope now:
- Explicitly out of scope now:
- Why this is the minimum viable unblock set:

## Do Not Build Yet Register (snapshot)
- [list top deferred items with rationale]

## Risks and assumptions
- Remaining unknowns:
- Risk if we under-build:
- Risk if we over-build:

## Evidence appendix
- Link all review IDs included:
- Link pilot artifacts:
```

---

## 7. Pre-populated internal signals (inferred from existing repo docs/code)

This section is **not** external pilot evidence. It is a starter hypothesis set derived from current repository contracts.

| Signal ID | Inferred signal | Source | Suggested taxonomy | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| INF-01 | Weight creation/raking is explicitly out of current pilot scope and may emerge as blocker only if repeatedly observed | `docs/pilot_00_brief.md`, `docs/blue_02_feature_matrix.md`, `docs/tracker_00_implementation_status.md` | `WT-CREATE` | Medium |
| INF-02 | Nets/derived-variable workflows are named as potential processing blockers needing discovery before build | `docs/tracker_00_implementation_status.md` | `NET-DERIVE` | Medium |
| INF-03 | Saved banner/break plans are listed as potential minimum processing candidates, but currently unvalidated by pilot observation | `docs/tracker_00_implementation_status.md` | `BANNER-PLAN` | Medium |
| INF-04 | Repeatable transformation recipes are identified as potential recurring need, especially for tracker/wave workflows | `docs/tracker_00_implementation_status.md`, `docs/blue_02_feature_matrix.md` | `RECIPE-REPLAY` | Medium |
| INF-05 | Full processing breadth is intentionally deferred; discovery must prevent premature expansion into broad SPSS-replacement scope | `docs/pilot_00_brief.md`, `docs/roadmap_00_strategic_guide.md` | `OTHER` | High |

Working rule: inferred signals can guide what to watch for, but cannot be promoted to `PILOT-4b` scope without external observation evidence.
