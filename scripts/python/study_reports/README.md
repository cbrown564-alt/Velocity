# Study reports from canonical codebooks

This builds a tablebook (`.xlsx`) and a findings deck (`.pptx`) for any study converted by `scripts/python/study_canonical`. Tables come from the canonical codebook alone. The deck's storyline comes from a per-archetype module plus a short spec that states the study's choices, such as the banner, the brands and the measures.

```bash
# From the repository root, in the study venv (see study_canonical/README.md) plus openpyxl.
python scripts/python/study_reports/build.py SBT-001
python scripts/python/study_reports/build.py SBT-002
python -m unittest discover -s scripts/python/study_reports/tests -v
```

Outputs go to `evals/research_quality/projects/synthetic/<ID>/reports/`:

| File | Contents |
| :--- | :--- |
| `<id>_tables.xlsx` | Workbook with these sheets: Read me, Contents, Key measures, Chart data, one T sheet per table, Data (long), Definitions. |
| `<id>_deck.json` | The deck as data: slide types, titles, series, bases. |
| `<id>_deck.pptx` | That spec rendered by `render_deck.mjs` (pptxgenjs, native editable charts). |
| `<id>_facts.json` | How many candidate developments the storyline considered. |

## Pieces

| File | Role |
| :--- | :--- |
| `engine.py` | Loads a canonical study. Computes weighted shares, means and NPS, Kish effective bases, Wald tests, Holm adjustment and banner column letters. |
| `tables.py` | Turns codebook variables and sets into tables. Each question type has its own layout (single, scale with nets and mean, 0–10 with NPS, multi-response, brand grid, brand × attribute grid, battery). Universes and valid bases come from the codebook. Don't know / prefer not to say / not answered are listed below each table as counts and kept out of the base. |
| `tablebook.py` | Generic workbook writer. Covers banners with group letters, wave-on-wave comparison, Holm groups, low-base rules, Data (long) and Definitions. |
| `archetypes/tracker.py` | Tracker storyline: step changes, gradual trends and subgroup trends, with materiality thresholds. Merges an event with its recovery. Adds an age table only where some groups moved and others didn't. |
| `archetypes/concept_test.py` | Concept test storyline: scorecard, Holm pairwise tests with a 5-pt materiality bar, full distribution, pre-specified subgroup interaction, likes/concerns, routed-base check. |
| `render_deck.mjs` | Renders any deck spec. Slide types: cover, findings, bar, stacked, line with side panel, table, method. |
| `specs/*.json` | Per-study choices: banner, entities and colours, measures, layout, materiality, low-base rules. |

## Rules the storyline follows

- **Tested claims only.** Titles state only what a test supports: significant at 95% *and* above the materiality threshold. Nothing is called stable, steady or unchanged.
- **Subgroup trends need a higher bar.** They're screened at 99%, need twice the materiality threshold, and need bases of 50 or more in every wave. They're reported only when the total-market change is not significant.
- **Concept comparisons.** These use Holm-adjusted pairwise tests. A lead is called a lead only if it is also material. Otherwise the title says the lead is below materiality, or that there is no clear winner.
- **Routed measures.** If a routed question reaches very different shares of each concept cell, the deck says the measure is not comparable instead of ranking it.

## Verification

- `tests/test_reference.py` recomputes all 147 SBT-001 reference analyses. It covers estimates, unweighted bases, wave-on-wave differences and p-values. It also recomputes the SBT-002 concept metrics, Holm pairwise tests and the pre-specified interaction. All match.
- `tests/test_storyline.py` checks the narrative against the studies' built-in traps. It uses hidden files for evaluation only. It checks that:
  - the planted developments are found;
  - the unweighted-only Pulse consideration surge is not claimed;
  - no claim rests on a base under 50;
  - the routed premium measure is flagged;
  - "leads" is used only when the lead is significant and material.
