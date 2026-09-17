# Native PowerPoint integration QA — SBT-001

## Execution result

The native-chart integration was executed against an equivalent local harness using `python-pptx` and LibreOffice rendering. This exposed two implementation issues in the first code pass and led directly to the current branch fixes:

1. the initial XY dumbbell design unnecessarily deferred connector construction to OOXML post-processing;
2. the SBT-001 acceptance plan incorrectly expected 13 native charts although its own slide mapping totals 12.

Both are corrected on the branch.

## Native XY dumbbell decision

The reusable dumbbell now uses **one native XY line-with-markers series per row**, containing exactly two points at a shared Y coordinate. Therefore:

- start endpoint = native chart point;
- end endpoint = native chart point;
- connector = native chart series line;
- editing either endpoint through Edit Data moves the point and connector together;
- no PowerPoint shape encodes the numeric distance;
- no error-bar OOXML post-processing is required for the core dumbbell primitive.

This is simpler, more robust and more inspectable than the earlier helper/error-bar proposal. Helper data remains useful for category Y positions and richer label strategies, but not for the connector itself.

## Package inspection

The generated integration artifact contained:

- **12 native chart objects**;
- **12 embedded workbook objects**;
- expected chart counts by slide: `[0, 3, 1, 1, 1, 1, 2, 2, 1, 0]`.

That mapping is now canonical in `native_chart_plan.json`.

Every quantitative slide (2–9) therefore contains native Office charts; Slides 1 and 10 are intentionally text-led.

## Render QA

The first full-deck render confirmed that native Office charts can sustain the intended editorial page system, but also revealed a predictable trade-off: chart defaults are visually plainer than the prior shape-built publication graphics. That trade-off is accepted. The quality work now belongs in chart defaults, typography, plot-area sizing, direct labels and editorial framing rather than replacement of chart marks with shapes.

The first render also exposed headline/dek crowding on several analytical pages. The branch generator now uses a smaller 26pt analytical headline with a larger reserved title area. Series naming is also explicit for the Harbour comparison rather than `Series 1 / Series 2`.

## Remaining visual refinements after merge

These are normal primitive-level improvements, not architectural blockers:

- cell-linked/direct category and endpoint labels for XY dumbbells so the legend can usually disappear;
- stronger marker differentiation for dumbbell start/end states;
- direct entity labels for position/change scatter instead of a legend;
- selective endpoint labels for trend charts;
- chart-native zero/reference series where a reference line materially aids reading;
- standard percentage/NPS number formats;
- explicit base/question/source footer renderer;
- significance letters and confidence-interval/error-bar support;
- exportable `.crtx` equivalents for manual PowerPoint authoring where useful.

## E6 result

The architecture now satisfies the milestone's central requirement:

> quantitative data are represented by native Office chart objects with embedded inspectable data; editorial design is layered around those charts.

The shape-built v3 deck remains a useful visual/storyboard reference but is no longer an acceptable canonical E6 deliverable.
