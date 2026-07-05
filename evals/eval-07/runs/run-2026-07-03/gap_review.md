# EVAL-07 Capability Gap Review

## Strategic Read

`EVAL-07` is the first eval frozen against the actual pilot wedge — tracker updates for boutique agencies — rather than a teaching file. It shows that the full raw-agency-wave → analysis-ready → story-template-deck loop, and the next-quarter wave refresh, both complete against the real engine using only shipped primitives, with every displayed number checked against a committed, auditable ground truth.

The significance of this run is less "a new capability landed" and more "the capabilities we already shipped compose into the pilot's headline outcome without new engine surface." That is the strongest possible evidence for the PILOT-5 "bounded tracker update" claim, because it is reproducible and audited rather than demoed live.

## Major Findings

### 1. Engine parity on the flagship demo is real, not asserted

- Class: Benchmark baseline validated
- Judgment: The trust pack moves from "parity on sleep/BSA" to "parity on the flagship demo."
- Evidence: `tests/golden/brand_tracker_parity.test.ts` reproduces weighted funnel metrics within 0.1pt on Waves 4/3/5, and confirms the planted rank change (Beacon over Meridian on consideration in W4).

This matters because the deck's action titles quote ground-truth numbers; parity makes the whole narrative defensible line by line.

### 2. The pilot loop needs no new engine surface

- Class: Scope discipline validated
- Judgment: Weight discovery, fuzzy mapping, recodes, weighted significance, deck build/export, and session replay already compose into the readout.
- Evidence: the recipe (`demo:brand-tracker-recipe`) and deck (`demo:brand-tracker`) demos run to exit 0 with zero manual repair; the session `transformLog` replays derived variables on reopen.

This keeps `S5-PREP-1` Frozen and `PILOT-4b` Blocked on external discovery, exactly as the plan requires.

### 3. The wave refresh honors the honesty contract

- Class: Deliverable / defensibility validated
- Judgment: The refresh recomputes but never silently rewrites.
- Evidence: on Wave 5, the dataset-replacement review is READY for saved recipes on shipped variables; recomputed titles are queued for human confirmation; every non-significant W4→W5 move is titled "broadly stable"; and the previously significant unaided-awareness headline is flagged as a demotion candidate now that it is flat (+1.4pts, not significant).

### 4. RECIPE-REPLAY is the one named, deferred limitation

- Class: Capability gap (deferred by design)
- Judgment: Cross-dataset recode replay is genuinely missing, but building it is out of scope.
- Evidence: a slide whose recipe references a recode-derived net (`consider_atlas_t2b`) blocks the Wave-5 replacement review; the refresh therefore re-runs on shipped variables only. This is INF-04, made concrete rather than newly discovered.

## Sufficiency Assessment

For the pilot archetype, this is sufficient evidence that the tracker-update outcome is achievable today on shipped primitives with audited numbers. What is not validated is an automated cross-wave recipe replay (RECIPE-REPLAY) — deliberately, because that is `PILOT-4b` work gated on external pilot observation.

## Recommended Next Investments

1. Pursue consultant sign-off (`brand_tracker_north_star_signoff.md`) to promote the agent-built deck from candidate to north-star exemplar.
2. Keep `validation/brand_tracker_ground_truth.json` as the regression anchor; re-run EVAL-07 on engine changes (any layer dropping 2+ points is a regression).
3. Treat `RECIPE-REPLAY` as the next real capability question for the wedge, sequenced only with external pilot evidence.
