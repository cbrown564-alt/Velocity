# Researcher Journey and Output Quality Plan

**Status:** Track A implemented and verified on 23 September 2026; Track B remains active. The [tracker](tracker_00_implementation_status.md) owns current priority and progress; this document owns the sequence and completion evidence for these two workstreams.

## Decision

Continue improving the existing researcher journey in the running product. Treat PowerPoint and spreadsheet output quality as a separate, research-led track. The current exports work technically, but that does not establish that a researcher would use them as professional deliverables. Do not infer the target style from Velocity's present output.

The two tracks can proceed independently. Output research should inform exported artifacts; it should not hold up improvements to finding variables, building an analysis, or understanding the result on the Canvas. Both tracks use one representative dataset and saved analysis first, then test important exceptions before spreading changes.

## Track A — Continuous researcher journey

**User loop:** open a dataset → find and choose variables → inspect a result → save/reopen → initiate export.

Use the brand tracker example as the first slice because it already exercises weighting, a saved crosstab, and both export formats. Follow it with a second dataset whose variable labels and structure differ. Preserve raw source metadata; improving labels at ingestion or in a prepared dataset is separate work, and the interface must not silently change statistical or semantic meaning.

| Step | Result to produce | Evidence that closes the step |
| :--- | :--- | :--- |
| A1. Capture the current loop | Current screenshots at supported viewport sizes, a short interaction log, and the top friction points. Include first use, saved-work reopen, and the important failure or recovery path. | Screenshots and a reproducible path linked from [user journey evidence](user_journey_screenshots.md); each issue names a user action and observed consequence. |
| A2. Make the analysis result the focus | One Canvas layout in which the table or chart is the clear visual centre, with the next likely action nearby and secondary controls quieter. Keep recipe, weighting, filter, and significance state inspectable. | Side-by-side rendered views, direct use of the full loop, keyboard and pointer checks, and no loss of analysis state. |
| A3. Simplify variable selection | Search and inspection make it clear which question is selected and where it will be placed. Handle long or unclean names through wrapping, reveal, and context where possible; record cases that require metadata cleanup. | User can find and place the intended variables without guessing from truncated text; test with short, long, and duplicate-looking names. |
| A4. Refine the handoffs | Upload/reopen, selection, analysis, review, and export each show what happened and the next useful action without competing prompts. | One uninterrupted end-to-end walkthrough, including a recoverable error; saved recipe and result survive reopen. |
| A5. Repeat on exceptions | Apply the proven interaction pattern to another dataset and to table/chart, one/many slides, and empty/populated states where they differ. | Focused checks plus direct screen inspection; `npm run ci` and `npm run test:e2e` for affected browser journeys. |

Work in small slices: observe one problem, change the smallest coherent part of the loop, inspect the rendered result, and update the journey evidence. A1 starts immediately; A2 and A3 may follow in either order after the baseline. A4 uses the resulting patterns, and A5 follows a working first slice. The [UX modes](design_02_ux_modes.md) and [design system](design_01_system.md) remain the owners of lasting UI rules.

### Track A completion evidence — 23 September 2026

The [current journey capture and interaction log](user_journey_screenshots.md#september-23-track-a-journey-capture) closes A1–A5 for the representative slice. The [browser path](../tests/e2e/researcher-journey.spec.ts) exercises first use, weighted brand table/chart, search with no results and recovery, full selected-question inspection, saved-work reopen with the same table and applied weight, and PowerPoint review. It repeats table/chart and empty/populated states on `sleep.sav`, then confirms that a two-slide export names the empty-slide repair needed. Screenshots cover 1440×900 and the recommended minimum 1280×800, plus a 1024×768 exception.

The Canvas slide and statistics line now use a 1120px maximum reading width. The insert palette reveals the complete selected label and source name and states the actual default destination. A narrow-width notice no longer covers the toolbar or blocks pointer controls. [Before/after images](user_journey_screenshots.md#problems-found-and-changes-made) show the hierarchy and selection changes. Source metadata, statistical meaning, and saved session structures were left intact.

The focused palette and narrow-width component tests, `npm run ci`, and all 27 `npm run test:e2e` browser journeys passed. These are implementation checks. The product owner has not yet judged the revised experience through direct use; that would be validation, not a condition for completing this reversible implementation track. The source-derived brand question and generated title remain awkward and are recorded for metadata preparation or researcher editing.

## Track B — Output quality evidence and redesign

**Question:** What do strong market research spreadsheets and PowerPoint exhibits actually look like, and which of those qualities should Velocity produce by default?

Study the two formats separately. A PowerPoint chart communicates a finding in a deck; a spreadsheet supports inspection, reuse, and checking. A shared color palette alone is not a quality standard. The earlier [report-quality plan](workstreams/deck_native/07_report_quality_experience_plan_v2.md) is background for narrative and editable deck requirements; this track establishes current, format-specific visual evidence before redesigning either export.

| Step | Result to produce | Evidence that closes the step |
| :--- | :--- | :--- |
| B1. Assemble source examples | A small, traceable collection of real research outputs: public research publishers such as Pew Research Center; market research vendors and tools such as Displayr/Q; agency or client-facing report examples; and well-formatted analysis workbooks. Include both excellent and ordinary production examples, with source, date, format, audience, and access rights. | Linked source inventory with actual pages, slides, or sheets to inspect. Vendor feature pages alone do not count as output examples. |
| B2. Compare the craft | Annotated examples showing how each format handles title and finding, chart/table choice, labels, bases, footnotes, uncertainty, color, hierarchy, whitespace, density, editable structure, and reuse. Note where sources disagree. | A visual comparison board with large crops and short annotations; separate PowerPoint and spreadsheet patterns. |
| B3. Audit Velocity's current output | Export the representative analysis to PPTX and XLSX, render or open both in their native applications, and compare them with matched reference examples. Record technical defects, visual defects, missing research context, and manual rework separately. | Before images and an ordered gap list tied to specific slides, charts, or cells. |
| B4. Define two reference outputs | Make one target PowerPoint exhibit and one target spreadsheet sheet for the same data, preserving accurate numbers and provenance. Choose defaults from the observed patterns; explain deliberate departures. | Reviewable artifacts and a short format-specific rubric. The product owner can judge whether each would be a useful starting point. |
| B5. Implement one export slice per format | Bring one representative chart/table and one spreadsheet sheet toward their reference output. Keep numbers, bases, filters, weights, significance, editability, and source labels correct. | Rendered before/after comparison, workbook inspection, focused export tests, and a record of remaining manual work. |
| B6. Extend only proven patterns | Apply the accepted format rules to other chart/table types, wide or sparse results, and multi-slide exports. | Sample outputs inspected directly; golden/export checks and `npm run ci`. |

B1–B3 are research and diagnosis; they do not authorize a broad exporter restyle. B4 answers what to build. B5 proves one slice before B6 spreads it. If a useful reference is inaccessible or cannot be copied, record its observable characteristics and use a permitted example instead. Avoid treating vendor marketing screenshots as evidence of typical exported quality.

## Dependencies and next pull

| Start now | Depends on | Can run alongside |
| :--- | :--- | :--- |
| A1: capture and use the current researcher loop | Current app and representative dataset | B1: collect output examples |
| B1: source real PPTX and workbook examples | Public or otherwise permitted material | A1 |
| B3: inspect current exports | Representative saved analysis | A2/A3 once A1 is recorded |

The first useful delivery is **A1 plus B1**: a current screen baseline and a source inventory for both output formats. Then improve one Canvas or variable-selection problem while comparing actual outputs. Keep findings and status in the tracker and the linked evidence artifacts, rather than adding another status board.

## Boundaries

- Do not fold the output-quality investigation into the Canvas visual pass. Canvas hierarchy can improve without deciding how client deliverables should look.
- Do not “fix” raw question titles or ambiguous variable names by inventing meaning. Record metadata-dependent cases for the preparation workstream; use readable wrapping and full-text access in the meantime.
- Do not call exports high quality because they are editable, render without clipping, or pass golden tests. Those checks prove different things.
- The product owner is the current research tester. External sessions or a paid pilot are not prerequisites for this work.
