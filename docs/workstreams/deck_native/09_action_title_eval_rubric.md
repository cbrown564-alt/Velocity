# Action-Title Eval Rubric

**Status:** Draft for human review
**Date:** 2026-06-28
**Workstream:** Deck-native SAV-to-deck experience
**Supports:** `07_report_quality_experience_plan_v2.md` §8.1 (action-title spec), §9.3 (story-quality + action-title eval), §7 (failure modes); `08_brand_tracker_story_template.md` §8 (conformance checklist).

> **Why this exists.** Action (takeaway) titles are the highest-leverage, most automatable storytelling element and the load-bearing part of "narrative usefulness." "Each slide has a takeaway title" is too coarse to grade a draft or gate a release. This rubric makes title quality **scoreable per title and aggregable per deck**, by humans now and by an agent later, so the narrative dimension of the quality rubric has teeth.

## 1. What a title is scored against

Every title is scored **against its own slide**, not in isolation — support and defensibility can only be judged with the data the title claims to summarize. The evaluator needs, per slide: the title text, the slide's data (table/chart values, bases, significance flags), and the slide role (`context | finding | comparison | caveat | recommendation | appendix`). Context, divider, and appendix slides are scored on a reduced criteria set (see §5).

## 2. Two gates, four graded criteria

A title first passes two **hard gates** (binary). A gate failure forces band **Reject** regardless of everything else — these protect against the two most dangerous failures (a pretty lie, a topic label). It is then scored 0–3 on four **graded criteria**.

### Gates (must pass — failure ⇒ Reject)

| Gate | Passes when | Fails when (⇒ Reject) |
| :--- | :--- | :--- |
| **G1 · Supported** | Every claim in the title is traceable to data on the slide. | The title states a number, direction, rank, or "first time" the slide does not show, or contradicts the slide. |
| **G2 · Defensible** | The title claims no more certainty than the stats support: significance only where tested significant; "drives/causes" only where the analysis supports causation. | Claims a significant move that is within margin of error ("significance theatre"), or asserts causation from correlation. This is the "confident but indefensible" failure — never offset by polish. |

### Graded criteria (0–3 each)

**C1 · Conclusion (topic → takeaway)** — the core axis.

| Score | Meaning | Example (brand tracker) |
| :--- | :--- | :--- |
| 0 | Pure topic label; names the subject, states nothing. | "Brand Awareness" |
| 1 | Topic with a vague gesture at change; no conclusion. | "Awareness trends this wave" |
| 2 | States a conclusion but generic or hedged. | "Awareness improved this wave" |
| 3 | States a specific, decision-relevant conclusion. | "Unaided awareness rose 5pts to 41%, now ahead of Brand B" |

**C2 · Specificity (quantified direction + magnitude)** — only where the data has it.

| Score | Meaning |
| :--- | :--- |
| 0 | No number, no direction, where both were available. |
| 1 | Direction only ("awareness up") with no magnitude. |
| 2 | Direction + magnitude, missing the resulting level or the comparator. |
| 3 | Direction + magnitude + landing value/comparator ("up 5pts to 41%, ahead of B"). |

**C3 · Comparison framing** — *conditional; score only on slides where a comparator (prior wave / category / competitor) is present. Otherwise mark `n/a` and exclude from the mean.*

| Score | Meaning |
| :--- | :--- |
| 0 | Reports a level with no comparison though one was available (the cardinal tracker sin — "change is the story"). |
| 1 | Implies change without naming the comparator. |
| 2 | Names one comparator (vs. prior **or** vs. category). |
| 3 | Frames against the comparator that matters for the decision (vs. prior **and/or** category, whichever the slide argues). |

**C4 · Form discipline** — mostly mechanical, auto-checkable.

| Score | Meaning |
| :--- | :--- |
| 0 | >2 lines, or so long the point is lost, or passive/nominalized to the point of vagueness. |
| 1 | Over length (>15 words) or notably passive, but parseable. |
| 2 | Within length, active, minor clutter. |
| 3 | ≤15 words, ≤2 lines, active voice, no chartjunk phrasing, reads cleanly. |

## 3. Per-title band

```text
if G1 fails or G2 fails:        band = Reject
elif C1 == 0:                   band = Reject        # a topic label is not a title
else:
    score = mean(C1, C2, C4 [, C3 if not n/a])
    band  = Strong if score >= 2.5
            Good   if score >= 1.75
            Weak   otherwise
```

| Band | Meaning | Reviewer action |
| :--- | :--- | :--- |
| **Strong** | Exemplar; matches the north-star deck. | none |
| **Good** | Usable after a light edit. | optional polish |
| **Weak** | Topic-ish, generic, or under-specified. | rewrite before client-facing |
| **Reject** | Unsupported, indefensible, or a bare topic label. | **blocks**; must be fixed |

## 4. Deck-level rollup and gate

Aggregate per-title bands over **body slides** (roles `finding`, `comparison`, `recommendation`) plus the exec-summary takeaways. Tie the thresholds to the v2 promotion bar (narrative must score 2+, and ≥1 deck must hit narrative 3).

| Deck metric | Narrative = 2 (release floor) | Narrative = 3 ("works well") |
| :--- | :--- | :--- |
| Gate failures (G1/G2) across body slides | **0** (hard) | **0** (hard) |
| Body slides banded Good or Strong | ≥ 90% | ≥ 95% |
| Body slides banded **Strong** | ≥ 40% | ≥ 70% |
| Exec-summary takeaways | all Good or Strong | all Strong |
| Any Reject on a body slide | blocks export of that slide | blocks |

> A single G2 failure anywhere is treated as a deck-level red flag in pilot review, not just a per-slide block: an indefensible title that shipped means the defensibility guard leaked.

## 5. Reduced scoring for non-body slides

- **Context / title slide:** descriptive heading is acceptable; score G1 only (must not misstate base/wave/dates).
- **Section dividers:** scored as exec-summary takeaways (C1 + C2; C3/C4 light).
- **Caveat slides:** C1 measures whether the limitation is stated as a conclusion ("Low base among under-25s — read directionally"), not a topic ("Limitations").
- **Appendix:** exempt from C1–C4; G1 (supported) still applies.

## 6. Auto-checkable vs. judgement

Split so the harness can run cheap checks without an LLM and reserve model/human judgement for the rest.

| Check | Method |
| :--- | :--- |
| C4 length (≤15 words / ≤2 lines) | mechanical (token/line count) |
| C4 passive-voice / nominalization heuristic | mechanical (regex/POS heuristic), flag for review |
| C1 = 0 "topic label" heuristic (noun phrase, no verb/number) | mechanical pre-filter, confirmed by judgement |
| C2 presence of a number + direction word | mechanical signal feeding C2 |
| G1 support (claim traces to slide data) | **judgement** (agent/human) against slide values |
| G2 defensibility (significance/causation honesty) | **judgement** against significance flags + analysis type |
| C1 conclusion quality, C3 comparator relevance | **judgement** |

Mechanical checks run on every export; judgement checks run in the agent-draft eval and pilot review. A title can pass all mechanical checks and still be Reject on judgement (e.g., a well-formed sentence the slide doesn't support).

## 7. Agent-evaluable output schema

The eval emits one record per slide so results are diffable across runs and against the exemplar.

```json
{
  "deck_id": "brandtracker-fixture-01",
  "run_id": "2026-06-28T14-02Z",
  "slides": [
    {
      "slide_index": 4,
      "role": "finding",
      "title": "Unaided awareness rose 5pts to 41%, now ahead of Brand B",
      "gates": { "G1_supported": true, "G2_defensible": true },
      "criteria": { "C1_conclusion": 3, "C2_specificity": 3, "C3_comparison": 3, "C4_form": 3 },
      "comparison_applicable": true,
      "score": 3.0,
      "band": "Strong",
      "notes": "Direction+magnitude+landing+comparator; sig vs prior wave confirmed on slide."
    },
    {
      "slide_index": 7,
      "role": "finding",
      "title": "Brand Attributes",
      "gates": { "G1_supported": true, "G2_defensible": true },
      "criteria": { "C1_conclusion": 0, "C2_specificity": 0, "C3_comparison": 0, "C4_form": 2 },
      "comparison_applicable": true,
      "score": 0.0,
      "band": "Reject",
      "notes": "Topic label; states no takeaway. Rewrite to name the attribute that moved."
    }
  ],
  "rollup": {
    "body_slides": 14,
    "gate_failures": 0,
    "pct_good_or_strong": 0.86,
    "pct_strong": 0.5,
    "exec_summary_all_good_or_strong": true,
    "narrative_band_supported": 2,
    "blocks": ["slide_7"]
  }
}
```

Store under `demo/artifacts/report-quality/<run-id>/action_title_eval.json` and summarize in `visual_review.md`.

## 8. Calibration set (golden titles)

Maintain ~12 labelled examples (brand-tracker context) as the eval's regression anchor — re-score them whenever the rubric or the judge model changes; bands must stay stable.

| # | Title | Expected band | Why |
| :--- | :--- | :--- | :--- |
| 1 | "Unaided awareness rose 5pts to 41%, now ahead of Brand B" | Strong | conclusion + quant + comparator, supported |
| 2 | "The leak is at the top: unaided awareness fell 5pts while conversion held" | Strong | diagnostic conclusion, specific |
| 3 | "Brand B overtook us on consideration for the first time in five waves" | Strong | rank change + history (needs wave history in recipe) |
| 4 | "Awareness improved this wave" | Good→Weak | conclusion but no magnitude/comparator (C2/C3 low) |
| 5 | "Health broadly stable, within margin of error vs. Q1" | Good | honest non-significance is a valid conclusion |
| 6 | "Brand Awareness" | Reject | C1 = 0 topic label |
| 7 | "Purchase Funnel" | Reject | topic label |
| 8 | "Awareness up 12pts — our campaign drove the gain" | Reject | G2: causation from correlation |
| 9 | "Consideration significantly higher vs. category" (move is +1pt, n.s.) | Reject | G2: significance theatre |
| 10 | "Some shifts seen across various brand metrics this period overall" | Weak | vague, no number, over-hedged |
| 11 | "'Innovative' associations fell 6pts — likely driver of weaker consideration" | Strong | honest causal hedge ("likely"), specific |
| 12 | "Limitations" (on a caveat slide) | Reject | caveat stated as topic, not conclusion |

## 9. Relationship to the other artifacts

- Feeds the **narrative usefulness** score in `07_..._v2.md` §7; the deck-level gate (§4 here) is how narrative ≥2 is evidenced.
- Implements the title line of the brand-tracker **conformance checklist** (`08_...` §8).
- The **exemplar diff** compares this eval's rollup for a generated deck against the same eval run on the north-star exemplar — the target is parity, not just passing thresholds.
- Bounds the **agent story-draft eval**: `velocity_draft_deck_plan` output is scored here before any human review, so weak titles are caught automatically.
