# Advanced native chart implementation notes

## Why this layer exists

Standard Office chart objects cover most research graphics directly. More sophisticated market-research forms should still remain native rather than falling back to manually positioned data shapes. These recipes define how to construct them while preserving Edit Data inspectability.

## XY dumbbell

### Display data

`category | start | end | change | base_start | base_end`

### Native chart construction

1. XY scatter chart.
2. Generate integer Y positions in display order.
3. Native `Start` scatter series: X=`start`, Y=`y_position`.
4. Native `End` scatter series: X=`end`, Y=`y_position`.
5. Connector is an Office chart construct, not a PowerPoint line shape. Preferred implementation is a helper scatter series with custom horizontal X error bars whose positive/negative lengths are derived from `end-start`; an alternative is a native line/scatter helper series where Office compatibility requires it.
6. Hide numeric Y-axis labels.
7. Use cell-linked data labels for category/start/end/change where supported; otherwise generate chart-native data labels from cached workbook values.
8. Keep DISPLAY DATA and HELPER DATA clearly separated in the embedded workbook.

### QA

- right-click Edit Data exposes category/start/end/change;
- connector moves when endpoint values change;
- no freeform connector encodes the distance;
- all rows share one defensible X scale;
- change labels derive from unrounded values.

## Diverging Likert

### Display data

`category | strongly_disagree | disagree | neutral | agree | strongly_agree | base`

### Helper transform

- strongly disagree → negative;
- disagree → negative;
- half neutral → negative;
- half neutral → positive;
- agree → positive;
- strongly agree → positive.

The native chart is a stacked horizontal bar with a zero-centred axis. Labels display absolute percentages from DISPLAY DATA, never signed helper values. Use a symmetric scale where practical so visual balance is not distorted.

## Difference versus benchmark

Prefer a native diverging horizontal bar over radar/spider charts for attribute profiles. DISPLAY DATA should preserve both brand and benchmark values as well as the derived difference. Zero means parity; over/under-performance is immediately visible.

## Position/change scatter

Use one native XY series per entity when entity-specific highlighting or legend control is required. DISPLAY DATA: `entity | position | change`. Zero-change reference may be a native helper series; if a PowerPoint annotation line is used, it is contextual and must not be the sole numeric encoding.

## Small multiples

Small multiples are multiple independent native charts placed into a shared layout. Synchronise:

- chart dimensions;
- plot-area dimensions;
- axis minima/maxima where measures are comparable;
- typography;
- label rules;
- gridline rules.

Do not fake facets with freeform marks.

## Statistical significance

Support three presentation patterns without breaking native data:

1. significance letters included as workbook label columns and rendered via chart data labels;
2. significance markers attached to chart-native labels;
3. confidence intervals as native error bars when the analysis supplies intervals.

Never position a shape-based star/dot as if it were a quantitative observation. A textual explanatory annotation may still be a normal PowerPoint text box.

## Low bases / suppression

The embedded workbook preserves raw display values plus base/suppression fields. The renderer may suppress the plotted value or apply a low-base visual convention, but must not silently delete the underlying research metadata.

## Template strategy

`.crtx` files are useful for authoring/Office reuse but are not the sole abstraction. Velocity's stable abstraction is the semantic primitive + data contract + Office recipe. This allows generation through python-pptx/OOXML while also making it possible to export corresponding chart templates for researchers working manually in PowerPoint.

## E6 inspectability QA

For every data-bearing slide record:

- expected primitive(s);
- native chart count;
- embedded workbook relationship count;
- human-readable display columns;
- helper columns if any;
- whether changing a display value updates the intended mark;
- whether any freeform shape encodes a quantitative value;
- rendered visual QA result.

Any quantitative shape mark is a hard failure even if the slide looks better than the native implementation.
