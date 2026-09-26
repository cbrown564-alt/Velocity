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

The first local corpus inventory is in [the Track B work catalogue](assets/output-quality-corpus/catalogue.md). It records the spreadsheet, presentation, survey-data, Q/Tableau, and adjacent CSV/PDF/Word files found across `/Users/cobro/Documents/Work`, with a folder census and a provisional list of useful review candidates. It is a private-workspace inventory, not a rights-cleared external reference library; source rights and visual quality remain to be checked before using any item as a benchmark.

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

### Track B first-slice evidence — 23 September 2026

The [public source inventory, visual comparison board, baseline audit, format rubrics, and review artifacts](assets/output-quality/track-b-evidence.md) record B1–B5 for the synthetic Atlas aided-awareness analysis. The baseline full XLSX failed on an apostrophe-led worksheet name. The revised exporter produces all 18 sheets, keeps significant percentages numeric, and includes title/context rows and frozen headings. The compact PowerPoint table has a readable title, larger cells, and a visible source/base/weight line; combined count-and-percent tables retain their denser layout and fractional weighted counts display to one decimal. Focused export tests pass, and the revised 28-page PowerPoint output was rendered through Microsoft PowerPoint and inspected. The workbook's final native Excel view remains to be checked because Excel stopped responding during the later UI inspection; file structure and values were checked independently.

B6 remains active. `npm run ci` passed. The first parallel browser run had four boot/teardown timeouts; each affected journey passed on a one-worker rerun. The product owner can now judge the [PowerPoint exhibit](assets/output-quality/atlas-awareness-exhibit.pptx) and [spreadsheet sheet](assets/output-quality/atlas-awareness-sheet.xlsx) as starting points. Apply further format rules only after that judgement and inspection of wide, sparse, chart and multi-slide exceptions.

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

## Researcher workflow exploration — 26 September 2026

**Status: design exploration, not a production change or a validated usability result.** This section extends the current journey owner in response to the product owner's request for a wider investigation. The existing three-mode implementation remains the current product. The alternatives below deliberately question its emphasis; they are proposals, not silently adopted contracts.

**Recommendation:** make the research question the unit of work, with evidence, competing explanations and researcher judgement attached to it. Let the answer become a selected argument assembled from that work. Keep slides as an important output and specialist editing surface. The distinctive moment should be: **“I can see why this finding matters, test what might undermine it, and change my mind without losing my work.”**

The [interactive concept comparison](assets/researcher-exploration/index.html) contains a question desk, a signal inbox and a living answer. The question desk includes a sample-mix investigation, editable interpretation, finding selection, an unresolved wording change, and selective review after a weight correction. Its numbers are a newly authored illustrative aggregate fixture, not a result from SBT-001 or a live engine run.

### What was inspected, and what that establishes

Repository baseline: `8b756a1f3a03450a0c15533cd7fd4ef200910e69` on `main`. Inspection covered the strategy, tracker, design owners, current journey capture, session types, DashboardShell, deck architecture, completeness readout and the experimental reviewer interface. Main's latest commits also include canonical study conversion and generated tablebooks/decks. Those improve research materials; they do not connect the experimental research loop to the production Canvas.

The separately open [PR #79](https://github.com/cbrown564-alt/Velocity/pull/79) describes completed remaining scoring and a portable reviewed handoff. It was read as an open proposal, not counted as merged production capability. Its stated bounds are offline handoff, no product session integration, and no measured researcher correction burden.

| Observed in the repository | Implication for this exploration |
| :--- | :--- |
| `DashboardShell.tsx` centres slides, active slide, palette and recipe inspector. The current screenshot is a crosstab headed by a long source-derived question. | Analysis is available; the interface offers little structure for the question being answered or why an analysis was selected. The researcher supplies that continuity mentally. |
| `VelocitySessionFile` v2 saves variables, transformations, filters, weights, slides, deck recipe and optional semantics. It has no first-class brief, finding or judgement block. | An assisted workflow needs durable domain state. A new panel with temporary chat history would not solve continuation. |
| `BuiltSlide` carries a `ResultEnvelope`; engine analysis and editable export foundations exist. | Preserve this computation and provenance investment. The gap is a layer connecting results to claims and decisions, not a replacement statistics engine. |
| The September journey captures verify selection, table/chart, save/reopen and export on two datasets. | These are useful interaction improvements. Passing the loop does not establish that the researcher got to a useful answer. |
| The completeness experiment found no demonstrated checklist advantage over general review in its scored comparison; correction burden is unmeasured. | Do not make a mandatory checklist or additional agent stages the new product centre. Use bounded, relevant checks and measure whether they help. |
| The offline reviewer preserves finding review and evidence, but is separate from the everyday analysis surface. | Bring review to the place the researcher is thinking, with direct access to the analysis, rather than making research a sequence of detached forms. |

This is a code/document/screenshot audit, not a newly completed live run of the production app. No researcher interviews were conducted. “Bottleneck” below means a reasoned product hypothesis unless explicitly tied to repository evidence. Frequency and time savings remain unmeasured.

### Follow the work, including the parts outside analysis

A realistic agency sequence is: interpret the client request → establish what decision the study can inform → locate prior work → reconcile files and questionnaire → define bases/weights/nets → explore → test explanations → select the story → shape exhibits → review internally → respond to client questions → incorporate corrected data or a new wave. Researchers loop backwards. A useful workspace must preserve the context through those loops.

Recruitment, survey design, fieldwork, scheduling and procurement can also be substantial bottlenecks. They are outside Velocity's current strongest capability. A full research operating system would dilute the present opportunity. The near-term entry is a supplied survey file, its documentation and a decision brief; the endpoint is a defensible answer that remains editable and reusable.

### Bottleneck register: causes, interventions and failure modes

| Bottleneck and concrete moment | Underlying cause | Proposed intervention | What could go wrong / how to judge it |
| :--- | :--- | :--- | :--- |
| **1. Translating the brief.** “Why are we losing younger customers?” becomes a pile of age crosstabs. | A business question mixes outcomes, populations, explanations and actions. The data may not measure the implied behaviour. | A small question list under the decision: what can be answered, which measures might answer it, and what is absent. Preserve the client's wording beside the operational question. | An elaborate intake wizard becomes unpaid admin. Start with pasted text and editable suggestions; allow immediate exploration. Judge whether the researcher corrects the interpretation before analysis proliferates. |
| **2. Understanding an unfamiliar file.** Repeated consultation of questionnaire, variable labels and DP notes. | Survey structure is distributed across documents; grids, routing and missing codes are easy to misread. | A study map grouping questions with source wording, response universe and linked variables. Show ambiguous mappings explicitly, with source references. | Attractive aliases can conceal wrong semantics. Never silently relabel source data. Assess correct variable identification and number of external-document switches. |
| **3. Deciding whether data is usable.** Hundreds of warnings but uncertainty about the one that matters. | Generic QA treats every anomaly as equally consequential. | A preparation view scoped to the active question: which comparisons are affected, what proposed fix changes, and a reversible preview. | Auto-cleaning can erase valid extreme values or structural missingness. Separate deterministic checks from inferred fixes; show changed records and affected analyses. Measure unresolved consequential issues, not warnings cleared. |
| **4. Reconstructing the correct base.** A consideration result is calculated among all adults instead of brand-aware respondents. | Population meaning is hidden in filters, routing and valid-code rules. | An evidence header with measure, universe, exclusions, weight and comparison. Selecting a base exposes the exact definition and both comparison bases. | A “base OK” badge overstates semantic certainty. Show the rule, its source and unresolved assumptions. Test with aided awareness, multiple response, customer-only metrics and DK/refused. |
| **5. Building routine cuts.** The researcher repeats the same measure across markets, ages or waves. | Low-level variable placement remains the main interaction. | Reusable, inspectable analysis sets attached to a question; expose a small set of relevant breaks, with a manual route always available. | Bulk analysis creates more review work and multiple-testing risk. Bound the family and distinguish exploration from pre-specified tests. Measure useful cuts retained per cut inspected. |
| **6. Finding the next useful question.** A difference looks interesting, but the next hour is indiscriminate slicing. | There is no explicit account of plausible alternatives or what evidence would distinguish them. | Contextual actions such as compare weighted/unweighted, inspect composition, check within groups, or compare wording. Explain why a check is relevant before running it. | Suggestions can steer the researcher into confirmation bias or unsupported methods. Keep untested alternatives visible; avoid a universal “find drivers” button. Judge whether the next action changes or sharpens the interpretation. |
| **7. Separating signal from noise.** A tiny subgroup yields the largest movement. | Significance, effect size, strategic materiality and reliability get conflated. | A restrained signal queue linked to the brief; show effect, uncertainty, base and why surfaced. Record the search family and suppressed low-base comparisons. | An opaque importance score becomes false authority. Use legible reasons, not a 93/100 insight score. Evaluate false excitement and material omissions as well as precision. |
| **8. Challenging a compelling story.** A six-point rise is drafted as growth before sample composition is checked. | The provisional explanation hardens into a slide title too early. | Put the original result and a plausible alternative side by side. Preserve supported, limited and unresolved interpretations separately. | Ritual counter-evidence adds clutter without changing judgement. Offer relevant checks, permit dismissal, and record only consequential reasoning. Test whether a seductive but unsound headline survives. |
| **9. Selecting what belongs in the answer.** Thirty correct observations become thirty slides. | Analysis inventory and communication structure share one container. | Separate candidate findings from selected answer sections. A section can combine several results; a result can support several claims. Keep set-aside work recoverable with an optional reason. | Another kanban board creates classification work. Default to a short outline, not a card wall. Evaluate argument quality and omitted material findings, not slide count alone. |
| **10. Polishing for the client.** Correct charts require manual relabelling, rebasing, footnotes and repeated formatting. | Analytical objects and editable communication drift apart. | Generate exhibits from selected evidence with the headline, base and qualification bound to it; provide client style presets and native chart data. | “One-click deck” can hide bad selection and encourage generic narrative. Limit exhibit families first; evaluate native editability, readable footnotes and amount of manual rework. |
| **11. Corrected files and new waves.** Nobody knows which of the 40 headlines needs rechecking. | Dependencies end at charts; narrative text and decisions lack evidence versions. | Preview changed inputs → changed results → affected findings → answer sections. Preserve manual wording and identify exactly what needs judgement again. | Hash changes can flag everything, while unchanged rounded values conceal methodological changes. Distinguish numerical, semantic, methodological and presentation-only changes. Test changed weights, wording, net definitions and missing variables. |
| **12. Reopening and handover.** “Why did we exclude that segment?” requires the previous analyst. | Files preserve outputs more reliably than reasoning. | Resume with the current question, last meaningful decision and unresolved issue. Keep rejected findings and their evidence, without forcing a full audit diary. Export a portable evidence/decision package. | Process overhead and misleading “saved” states undermine trust. Track only meaningful events automatically; distinguish local browser storage, portable backups and shared access. Measure time to resume without reconstructing work. |

The common issue is **reconstructing context between operations**. Faster calculations help, but reducing repeated interpretation and rechecking may be more valuable. That is the hypothesis to test; it is not an observed time saving.

### Where to concentrate first

Use consequentiality, repetition, fit with existing foundations and feasibility to choose the first slice. These are qualitative design judgements, not measured market scores.

| Opportunity | Near-term value hypothesis | Feasibility / dependency | Decision |
| :--- | :--- | :--- | :--- |
| Question → inspect evidence → revise finding → select answer → reopen | Covers the missing connection between current analysis and experimental research review. | Existing computation, provenance and export; new durable research state required. | **Build first.** One supported study and one decision question. |
| Selective review after corrected evidence | Recurring, consequential and easier to demonstrate than generic “insight quality”. | Requires the first slice's references and versioning. | **Include one correction in the first slice.** |
| Meaning-aware preparation | Potentially large benefit, but ambiguous semantics can dominate scope. | Questionnaire parsing, explicit rules, reversible transformations. | Resolve the one preparation issue that blocks the selected question. |
| Automatically ranked signal feed | Can reduce table scanning on established trackers. | Requires calibrated selection, multiplicity policy and coverage visibility. | Explore as a secondary view, not the first home screen. |
| General autonomous report agent | Broad promise; review burden and differentiation unclear. | Long chain of unproven choices. | Do not lead with it. |
| Fieldwork, recruitment and universal research repository | Important work, weak fit with the present code and a crowded market. | New integrations, permissions and operating model. | Outside the first slice. |

### Competitor patterns and what they actually change

Research conducted 26 September 2026 using official product pages and help documentation. Capability descriptions are vendor-documented, not hands-on performance findings. A live browser attempt to inspect Displayr's help UI was blocked by security verification, so no live usability comparison is claimed. Absence from these pages is not proof that a vendor lacks a capability.

| Product / documented pattern | What it helps with | Lesson for Velocity | Differentiation implication |
| :--- | :--- | :--- | :--- |
| **Displayr Research Agent** asks about goals, creates analyses and a report, and allows manual correction. Its help explains that automatic regeneration can overwrite manual edits. [S1] | Initial analysis/report production and contextual summaries. | Goals belong near analysis, and preserving editorial work is a real product constraint. | An agent plus charts is already available. Explore explicit claim-level change review rather than relying on regeneration. |
| **Displayr Data Preparation Agent and Skills** provide configurable preparation checks and reusable team instructions. [S2, S3] | Repeated setup and methodological consistency. | Reuse team knowledge and offer inspectable preparation. | “Research your way” and reusable methods are not unique positioning. |
| **Q** documents updating exported Office outputs and separately supports updatable text. [S4, S5] | Tracker reporting and avoiding manual copy/paste. | Editable, refreshable deliverables are expected by experienced researchers. | Updating a chart or text alone is not the proposed distinction; preserving and selectively revisiting the judgement is. |
| **Crunch** saves analysis bookmarks into decks with their filters and weights, and offers shared prepared objects. [S6, S7] | Quick exploration, reuse, continuity and handoff. | Saving should feel as easy as bookmarking a useful view. | Velocity's existing slide recipe is valuable but familiar; question/finding continuity needs to add value beyond it. |
| **Harmoni Discover and ChatHarmoni** combine investigator-led profiling and engine-run analyses. Discover ranks differentiating descriptors; its documentation warns that too many elements produce too much significant material. [S8, S9] | Finding potentially relevant differences with less manual crosstabbing. | A bounded comparison set matters as much as ranking. | “Models propose, engine computes” and automated discovery are already competitor patterns. |
| **Dovetail AI Chat** grounds answers in customer evidence and can turn research into useful communication. [S10] | Retrieving and communicating qualitative/customer knowledge. | Evidence should be accessible from the conclusion, in context. | Citation links alone are not distinctive; survey bases, transformations and change effects must be useful to inspect. |
| **Outset Research Objectives** makes research intent explicit to focus synthesis. [S11] | Relevance of qualitative synthesis to research goals. | Questions are productive navigation, not just prompt metadata. | Question-led synthesis alone is not novel. Velocity's opportunity is the quantitative investigation and revision experience. |
| **Maze** joins session highlights, themes and editable reports. [S12] | Moving from collection to evidence-backed reporting. | Keep evidence reachable inside the report and make editing straightforward. | Automated report assembly is established; compete on the quality of the judgement loop. |

The strongest positioning candidate is **a survey research desk that remembers and helps revise the reasoning behind the answer**. This is a proposed emphasis, not a claim of exclusive features or a defensible moat. Its defensibility would have to come from excellent survey semantics, repeatable numerical evidence, preserved researcher choices, and an unusually good revision experience.

### Three interaction models, and why one leads

**A. Question desk — recommended.** Left: the few questions that matter. Centre: the current piece of evidence and its interpretation. Contextual detail: universe, calculation, source and relevant alternative. Answer: only selected findings, arranged into a coherent argument. Changes: a preview of consequential updates. It accommodates uncertainty and nonlinear research without opening with a blank chat box. Risk: a question tree can become project-management overhead. Keep it short, editable and optional for manual analysis.

**B. Signal inbox.** A ranked list of movements and comparability issues, each opening into evidence and a decision. It feels efficient for a returning tracker analyst and makes a good update view. It is a weaker general home: it gives the system agenda-setting power, can overemphasise differences, and encourages clearing a queue rather than understanding a problem. Use it after a stable brief and comparison scope exist.

**C. Living answer.** An editable research memo with evidence in the margin. This is strongest for synthesis, senior review and answering client follow-ups. It preserves the reading experience and encourages argument rather than a series of charts. Starting here risks anchoring the researcher on fluent prose before the evidence has been explored. Use it as the answer view of A, with unresolved questions still visible.

**Selected combination:** A as the workspace, C as its answer view, and B as a bounded update/review view. Do not ship three competing navigation systems. The carousel compares the ideas; it is not proposed product navigation.

### The signature loop, made concrete

1. **The client question:** does Meridian's apparent preference growth warrant more investment? The researcher opens the question rather than choosing an empty slide layout.
2. **A reviewable starting point:** raw preference rises 24% → 30%; population-weighted preference is 26% → 26%. The researcher can see both, with comparable bases. There is no automatic “growth” label.
3. **One useful challenge:** select “Test the sample-mix explanation”. The higher-preference group's sample share rises 20% → 50%, while each group's preference rate remains unchanged. This explains the arithmetic in the fixture. It does not establish population equivalence or a causal claim.
4. **Researcher authorship:** keep, edit, or set aside the interpretation. The researcher's words and optional rationale remain distinct from generated suggestions. Keeping a finding means editorial selection; it does not certify statistical or semantic truth.
5. **A coherent answer:** the selected finding sits beside the unresolved trust question and the limits of the investment inference. A commercially important unanswered question deserves space even when it has no chart.
6. **A realistic interruption:** the provider corrects Wave 4's population target. Preview weighted preference moving to 28%. Only the dependent finding needs renewed attention; the trust-wording issue is unchanged. Preserve earlier wording and the old evidence for comparison.
7. **Production completion, still to build:** save, close, reopen and export the selected answer with the same evidence bindings. The concept does not pretend to perform these operations.

This loop is a better first demonstration than “upload a file and receive ten slides”: the researcher can see judgement being supported, exercise control and recover from a meaningful change.

### What should feel good

- **An obvious place to resume.** Return to the question and the latest meaningful decision, not a dashboard of counts or a long conversation transcript.
- **A calm central canvas.** One visual relationship dominates. Context sits beside it, full methods remain available, and controls appear at the point of use.
- **Little translation effort.** Use labels such as “Who is included?”, “What changed?” and “Keep in the answer”. Variable IDs and recipe syntax remain in inspectable detail.
- **Exploration has low commitment.** Inspect an alternative without duplicating slides or changing the selected argument. “Set aside” is reversible.
- **The researcher’s words survive.** No regeneration silently rewrites a carefully qualified interpretation. Show proposed edits and their reason.
- **Uncertainty is specific.** “Wording changed between waves” is more useful than a global confidence badge. Keep numerical precision, inference limits and editorial selection separate.
- **The report reads like an argument.** Use descriptive headlines, direct labels, quiet footnotes, consistent scales and enough whitespace to compare evidence. The exhibit supports the claim rather than merely filling a slide.

Visual direction: retain Velocity's neutral surfaces, restrained blue action, sage data marks and one sans-serif family. Use a crisp hierarchy and aligned data rather than decorative gradients, oversized cards, agent avatars or “AI thinking” theatre. The inline concept includes an adaptive dark treatment for the conversation host; this is not a proposal to prioritise production dark mode. Its compact mobile stacking supports review of the concept, not a claim that the full survey workbench is now a mobile product.

### Integration: reuse the engine, add the missing research objects

The new state should represent a small set of concepts, not duplicate every existing analysis configuration:

| Object | Required meaning | Existing connection |
| :--- | :--- | :--- |
| Research question | Original request, operational question, decision relevance, open/answered/limited state | New optional project/session block; editable by researcher |
| Evidence reference | Stable result identity, variable/recipe references, data and method version, exact universe and weight | `ResultEnvelope` and existing analysis recipe; heavy compute stays in worker |
| Finding | Claim text, support and counter-evidence refs, qualifiers, author/origin, revision history | New domain object; current review formats need explicit adapters |
| Editorial decision | Keep/set aside/revise, optional reason, person/origin and evidence version reviewed | Reuse experimental review semantics where compatible; no automatic approval |
| Answer section | Ordered argument with finding refs and selected exhibit refs | Existing deck/export layer consumes a projection, not a second calculation path |
| Change assessment | Affected references, type of change, prior state and unresolved review | Dependency comparison on versions and semantics; not just rendered numbers |

Session changes require a new version and migrations under `AGENTS.md`; do not repurpose the current optional semantic block. A v2 session should reopen unchanged with no research questions. Unsupported future fields must not be silently discarded on roundtrip. Browser-local persistence and portable export need explicit, tested recovery paths.

For the first implementation, support one prepared dataset with two waves, one preference measure, one group variable and an explicit weight. Bind the question and evidence in the current Canvas. Build deterministic comparisons first; model suggestions can be replaceable and optional. Use an explicit allowlist of supported analytical operations. Missing respondent overlap, complex design requirements or absent semantic information should remain unresolved instead of triggering an inappropriate generic test.

Change handling must distinguish:

- **Presentation-only:** title formatting changed; evidence and interpretation can remain current.
- **Numerical:** values or bases changed; re-evaluate dependent claims.
- **Methodological:** weight, exclusions or test changed, even if rounded values are unchanged; mark dependent claims for review.
- **Semantic:** wording, universe or net definition changed; comparability may fail, requiring a new series rather than a refreshed chart.
- **Missing dependency:** deleted or renamed variable; show a repair route without silently substituting a similar label.

This will require stronger identity than the current optional dataset checksum alone. Exact fingerprints should be generated in the compute/persistence layer, with scope sufficiently precise to avoid invalidating unrelated research. Model inference about whether a conclusion still holds should be a suggestion; the dependency change itself can be deterministic.

### The first build and the test that could disprove this direction

**Build boundary:** one question, one supported analysis family, one editable finding with support/counter-evidence, one selected answer section, one durable save/reopen, and one corrected-weight review. Include export of that section through the existing native chart path only after its evidence binding works. Keep manual table/chart work available. Do not begin with a universal agent, multi-user collaboration or all survey methods.

Have the product owner perform the same realistic task using the current Canvas, the proposed question loop and their familiar manual approach. Use matched variants to reduce recall effects and alternate order where practical. Record observations rather than imposing a recruitment gate.

Measure active time, context switches, corrections, unreviewed affected claims, material omissions and quality of the final argument separately. Count time spent reviewing automated suggestions; a fast draft followed by laborious correction is not a win. Track which suggested checks are useful, ignored or misleading. Ask for direct comparison of the resulting answers, not a vague satisfaction rating.

**Disconfirming evidence:** researchers ignore the questions because they already have a better structure; the review surface adds more work than it removes; the suggested challenges rarely alter a finding; correcting an input causes noisy wholesale invalidation; or reopening still requires reconstructing reasoning. If these occur, simplify toward the living-answer/bookmark model rather than adding more orchestration.

**Necessary outcome on the illustrative task:** the final answer must not present the six-point raw rise as demonstrated market growth; the trust comparison remains qualified; the weight correction flags the dependent finding; manual wording survives; and unaffected work stays accessible. Speed matters only after those outcomes.

### Prototype verification and limitations

The concept's JavaScript was executed in a DOM test environment. Checks covered question navigation, evidence expansion, editing and safe text rendering, selecting/removing findings, cancelling a proposed correction, marking selected findings stale after applying it, preserving researcher wording, reset, alternate concept interactions and independent arithmetic of the fixture. These are interaction/state checks, not browser layout verification.

The controlled browser rejected navigation to the local file under its protocol policy. No bypass was attempted. Consequently, this turn does **not** claim a fresh rendered desktop/mobile inspection of the prototype, a production browser walkthrough, full CI, or user validation. The inline version is available for direct inspection. The standalone artifact requires no data upload and contains no connected model, real analysis execution, session persistence, PPTX generation or network API. It uses local in-memory state; reset/reload loses edits. The existing production application and frozen studies are unchanged.

### Sources

All retrieved 26 September 2026. Vendor pages establish described capabilities, not independent quality or time-saving estimates.

- **S1:** [Displayr Research Agent](https://help.displayr.com/hc/en-us/articles/13279622054159-Research-Agent) — goals, analysis/report workflow and preservation of manual edits.
- **S2:** [Displayr Data Preparation Agent](https://help.displayr.com/hc/en-us/articles/13800601443599-How-to-Automatically-Check-and-Prepare-Your-Data-with-Data-Preparation-Agent) — selectable checks and preparation report.
- **S3:** [Displayr Skills](https://help.displayr.com/hc/en-us/articles/16286213287567-Skills) — reusable methodological instructions.
- **S4:** [Q: Exporting and Updating PowerPoint Reports](https://help.qresearchsoftware.com/hc/en-us/articles/8608206441999-Exporting-and-Updating-PowerPoint-Reports-Video).
- **S5:** [Q: Updatable Text](https://help.qresearchsoftware.com/hc/en-us/articles/4410187037327-How-to-Export-Updatable-Text-to-PowerPoint-using-R).
- **S6:** [Crunch: Using a deck to save analysis](https://help.crunch.io/hc/en-us/articles/360042242332-Using-a-deck-to-save-analysis).
- **S7:** [Crunch: Dataset Preparation](https://help.crunch.io/hc/en-us/articles/360040477891-Getting-Started-with-Dataset-Preparation-in-Crunch).
- **S8:** [Harmoni Discover Analysis](https://support.infotools.com/hc/en-us/articles/360040453473-Discover-Analysis).
- **S9:** [Harmoni overview](https://www.infotools.com/harmoni) — ChatHarmoni and analysis engine.
- **S10:** [Dovetail AI Chat](https://dovetail.com/product/ai-chat/).
- **S11:** [Outset Research Objectives](https://outset.ai/resources/blog/research-objectives-launch).
- **S12:** [Maze: Analysis and reporting for AI-moderated studies](https://help.maze.co/articles/9244710783-from-sessions-to-insights-analysis-and-reporting-for-ai-moderated-studies).

## Beyond survey software: preparation and analysis laboratory — 26 September 2026

This extends the earlier exploration at the product owner's request. It deliberately explores several possible products inside Velocity, rather than treating the first question-led desk as a settled destination. The six new [interactive sketches](assets/researcher-exploration/survey-laboratory-preview.html) complement, rather than replace, the three earlier concepts. Their [editable source](assets/researcher-exploration/survey-laboratory.html) and [interaction checks](assets/researcher-exploration/verify-laboratory.mjs) sit together.

### What the wider search changes

The opportunity is more specific than “an AI research workspace.” Data preparation tools make irregularities tangible through profiles, rows and repeatable operations. Notebooks make dependencies executable. Semantic layers make definitions reusable. Visual analysis systems make exploration branchable. These are mature interaction ideas to borrow, not capabilities Velocity can claim to have invented.

In particular, Microsoft's current Data Formulator describes persistent questions, intermediate findings, charts, branching and side-by-side comparison [B12]. This is a significant adjacent precedent for the first exploration's question-led desk. A thread plus an agent plus charts is not a sufficient distinction. Velocity needs to carry survey meaning through the whole loop: routing, respondent versus response bases, multiple-response sets, missing-response roles, weighting, comparability, uncertainty and the researcher's interpretation.

**Working product hypothesis:** a researcher should be able to touch an analytical choice and immediately see its meaning, numerical consequence and downstream consequences—without losing the prior state. The useful unit is a *reversible research decision*. A chat, notebook, table and preparation flow are different views onto it. This is a hypothesis about product usefulness, not a claim of market exclusivity or validated demand.

### Wider landscape: what to borrow and where the analogy breaks

Reviewed official documentation and primary research, retrieved 26 September 2026. These observations establish documented interaction patterns. They are not a hands-on usability ranking, an exhaustive market census, or independent evidence of time savings.

| Tool / family | Documented interaction worth studying | Survey translation | What must not transfer uncritically |
| :--- | :--- | :--- | :--- |
| OpenRefine [B1–B2] | Facets expose values and counts, narrow a temporary view, and support exploration alongside replayable editing operations. | Inspect a special response code, its distribution and source label before assigning a role. Keep inspection distinct from mutation. | A facet is not automatically a saved research population. Similar strings are not necessarily equivalent response categories. |
| Power Query [B3] | Column quality, distributions and profiles make preparation inspectable. Profiling can use a sample or the full dataset. | State the profiled scope prominently: all records, first N or selected subset. Show routed-out, refused and unknown separately. | A generic empty/error/valid classification erases survey semantics. Sampled profiling must not certify a whole file. |
| Tableau Prep [B4–B5] | Profile summaries, underlying rows, ordered changes and reusable cleaning steps connect operation to consequence. | Show before/after bases beside each transformation; replay a preparation recipe on the next wave. | An executable recipe can still be conceptually wrong when questionnaire meaning changes. |
| Dataiku [B6] | Visual preparation scripts can become reusable flow recipes. | Promote a useful one-off repair into a named study recipe with explicit inputs. | Turning every small recode into an enterprise pipeline introduces setup and maintenance overhead. |
| KNIME [B7] | Components encapsulate reusable workflows, configuration and interactive views. | Package a repeated survey task—such as a brand funnel—with its definitions and inspection surface. | Researchers should not need to understand a large node graph to calculate a net. |
| Hex [B8] | Pivot cells support direct field manipulation and downstream reuse; input cells connect controls to analysis. | Let a researcher construct a comparison, inspect its base, then reuse that result in a research note. | Totals, weighted percentages and multiple-response percentages need survey-specific aggregation rules. |
| marimo [B9] | Dependency-aware execution makes changes propagate; lazy execution can mark dependent outputs stale. | A changed weight invalidates the dependent evidence and interpretation; recompute evidence deliberately when expensive. | Human judgement is not a computed cell. Do not automatically rewrite it or label it reviewed. |
| Observable [B10] | Reactive dataflow connects inputs, calculations and visual explanations. | An answer can expose a small set of legitimate assumptions and show their consequences. | Unbounded reader controls can produce a different analysis while retaining the original conclusion. |
| dbt Semantic Layer [B11] | Shared metric definitions provide reusable semantics across downstream queries. | Treat a survey measure's universe, numerator, denominator and weighting policy as an addressable definition. | Shared definitions cannot collapse differences between incidence, conversion, respondent percentage and response percentage. |
| JMP [B13] | Linked selection connects observations across views; data filtering offers distinct selection and analysis inclusion behaviours. | Brush a cohort to inspect it, then explicitly choose whether it becomes the analysis population. | Every visual click must not silently change the analytical base. Selection also needs a keyboard route. |
| Data Formulator [B12] | Persistent analytical threads, branches, inspectable transformations and direct chart refinement. | Compare alternate analytical decisions while preserving their context and provenance. | Plausible generated transformations are not evidence of a defensible survey estimand or valid inference. |
| Boba [B14] | A research system for specifying and inspecting multiple analytical decision paths. | A small assumption lab can expose whether a finding depends on a defensible choice. | This is research inspiration, not a turnkey survey feature or proof of usability for Velocity's audience. |
| Voyager 2 [B15] | Mixed manual and recommended visual exploration, including partial specifications. | Hold the measure fixed and suggest a bounded set of meaningful comparisons. | More views are not necessarily more insight. Avoid unbounded subgroup fishing and attention overload. |

### Bottlenecks beneath the visible tasks

The first exploration focused on the path to an answer. This pass examines why researchers cannot comfortably trust, reuse or revise the ingredients of that answer. Priorities below are product judgement, not prevalence estimates from interviews.

| Bottleneck and symptom | Deeper cause | Intervention to explore | Failure condition / useful observation |
| :--- | :--- | :--- | :--- |
| “I have to open the codebook again.” | The value, label, routing and intended analytical role live in different places. | Preparation microscope: distribution → exact code → source meaning → scoped change preview. | If the researcher still leaves to understand a code, the inspection surface is incomplete. |
| “This percentage looks wrong.” | The denominator is hidden or conflates eligible, answered, weighted and raw bases. | Denominator inspector with a population-to-valid-response explanation. | If users cannot explain who counted, a more attractive chart has not helped. |
| “Where did those people go?” | A transient selection became a filter, or a cell-level missing rule became row deletion. | Separate inspection selection, saved cohort and active analysis population. | If users repeatedly misidentify their active population, the scope distinction is too subtle. |
| “Did I already try weighting this?” | Exploration overwrites settings; reasoning exists only in memory. | Branch comparison with explicit differences and a recoverable working branch. | If branches multiply without being revisited, retain a simple comparison/history rather than a workspace tree. |
| “The result depends on one choice.” | A single specification hides sensitivity. | Compare a bounded set of justified assumptions before final wording. | If the lab encourages selecting the biggest or most significant result, its interaction has failed. |
| “Two slides call this consideration but disagree.” | Display names substitute for measure identity; definitions are copied. | Measure studio with source-linked denominator and reusable identity. | If every minor exploratory change requires administration, the model is too rigid. |
| “Can I refresh this for the next wave?” | Reuse assumes schema and meaning are interchangeable. | Wave rehearsal detects exceptions before replacing the working dataset. | If a renamed or relabelled field silently passes as comparable, the rehearsal cannot be trusted. |
| “The numbers refreshed, but the story did not.” | Recalculation and judgement review are treated as one operation. | Reactive evidence, preserved prose and selective review state. | If everything becomes stale after a local change, review becomes noise. |
| “I prepared that in the last project.” | Useful recipes lack parameters, scope and portable source assumptions. | Reusable task components, initially within one tracker. | If adaptation is harder than recreating the operation, stop expanding the template system. |
| “I have twenty interesting cuts and no answer.” | Exploration optimises coverage instead of relevance to a question. | Comparison composer constrained by objective, available base and comparison family. | If suggested cuts add correction burden or distract from the question, make discovery manual. |
| “The client changed a control; is the headline still true?” | Published prose outlives its analytical conditions. | Bounded explorable answers with explicit supported states. | If changing a control leaves incompatible prose looking authoritative, disable the control or qualify the prose. |
| “Why was this record excluded?” | Quality flags, evidence and exclusion decisions have collapsed into one field. | Quality investigation showing the flagged records' contribution before applying a rule. | A flag should not itself authorize deletion; look for transparent reasoning and sensitivity. |

### Six interaction experiments

All six run locally on explicitly synthetic fixtures. They are distinct interaction experiments, not six new navigation destinations to add to the production app. State is independent between sketches to keep comparisons intelligible. No live data, model calls, statistical testing, storage or importing is implied.

#### 1. Preparation microscope — make meaning inspectable

**Moment:** a researcher notices that top-two satisfaction is unexpectedly low. The distribution includes code 97, labelled “Don't know,” in the denominator. The correct choice depends on the question being answered; exclusion is not inherently the only valid policy.

**Working interaction:** select a raw response code; see its count and source label; choose its measure-specific role; preview the new denominator and result; explicitly apply; undo. The fixture contains 240 records, 200 scale responses, 16 don't-knows, eight refusals and 16 not-asked responses. One hundred are positive. Including don't-knows gives 100/216 = 46.3%; excluding them gives 100/200 = 50.0%. Both the reason and the magnitude are visible. Respondents remain available for other questions.

**Design bet:** profiles should be an entrance to reasoning, not just a data-quality dashboard. Put the source distribution at left, the selected meaning in the centre and the analytical consequence at right. No opaque cleanliness score. No sweeping “fix all.” One reversible action.

**Unresolved:** whether roles should be a dataset default plus measure override, or entirely local. Grid items, multiple-response variables and user-defined missing ranges need richer policies. A production preview must use the engine's actual eligible base, not assume every selected code appears in every analysis.

#### 2. Population lens — direct manipulation with explicit scope

**Moment:** a researcher wants to understand who is behind a movement before deciding which segment to analyse.

**Working interaction:** select 18–34 or 35+ and see awareness and consideration for that group. The current analysis remains all respondents until “Analyse this selection.” Clearing restores the full population. The synthetic all-person population is 240, the aware denominator 160 and the positive numerator 64. Selecting 18–34 inspects 80 people and 32/64 consideration; adoption changes the current result from 40% to 50%.

**Design bet:** make exploration tactile while keeping “looking at” and “calculating among” distinguishable. This is useful friction at the point of analytical commitment, not a confirmation dialog after every click. The population strip belongs near the result, not in an easily missed global filter tray.

**Unresolved:** compound cohorts, exclusions, missing demographics, survey design effects and the exact distinction between selected rows and eligible responses. A real cohort should store its expression and data version, not a brittle list of transient row positions. The sketch's age controls stand in for linked brushing; free-form brushing is not implemented.

#### 3. Assumption lab — keep the alternatives in view

**Moment:** a reported increase may depend on weights or quality exclusions. Researchers can currently re-run these cuts, but retaining the comparison and reasoning is costly.

**Working interaction:** inspect three specifications and explicitly adopt a defensible one as the working analysis. Unweighted consideration rises from 54/144 to 64/160, or +2.5 points. An illustrative age-weight scenario gives 41.7% to 42.9%, or +1.2 points. Excluding eight flagged aware records in each wave gives 39.7% to 38.2%, or −1.5 points. That last branch is inspectable but cannot be adopted in this sketch because the flags have not been investigated. All branches remain visible after adoption.

**Design bet:** an analytical comparison table can be a better thinking surface than either a chat transcript or a sprawling node graph. Show base, changed assumption and effect together. Do not rank alternatives by effect size or significance. The spread is sensitivity, not a confidence interval; weighting in this fixture is a scenario, not a claim about population calibration.

**Unresolved:** how to bound the family of defensible alternatives and avoid a combinatorial explosion. Start with one changed dimension per branch. An eventual multiverse mode needs a stated rationale for the family, accounting for multiplicity where inference is performed, and clear separation of specification exploration from confirmatory claims. Do not turn this exploration into an automatic significance hunt.

#### 4. Measure studio — give definitions an identity

**Moment:** “consideration” means either propensity among brand-aware respondents or the incidence of being both aware and willing to consider in the sample. Both can be useful, but they answer different questions.

**Working interaction:** change the denominator from 160 aware respondents to 240 respondents. The same numerator, 64, moves from 40.0% to 26.7%. The label and readable definition change with it. Creating the second measure leaves the three existing outputs bound to the first. The unaware people's unasked consideration response is not imputed as a directly observed “no”; the second quantity is explicitly joint awareness-and-consideration incidence.

**Design bet:** let the researcher read the calculation as a sentence—count X, among Y, using Z—while still exposing exact source codes. A different estimand should acquire a separate identity instead of silently revising an old trend.

**Unresolved:** distinction between correcting a mistaken definition and intentionally creating a new estimand. Production should support both: a versioned correction with impact review, and a separate measure with an explicit relationship. Avoid a universal central catalogue as a prerequisite to ordinary analysis. Local measures can become reusable when the researcher actually needs reuse.

#### 5. Reactive research notebook — compute evidence, preserve judgement

**Moment:** adjusting a weight should update the calculation without either losing the researcher's prose or allowing it to masquerade as reviewed.

**Working interaction:** switch from unweighted to the age scenario. The old result remains visible but is marked out of date. Recompute to show +1.2 points. The editable interpretation remains intact and needs explicit review. Reviewing the new result restores current status. This deliberately explores lazy execution rather than automatically running every dependent operation on every keystroke.

**Design bet:** an ordered notebook can expose a small research argument more calmly than a canvas of panels. Each cell has a role: specification, computed evidence, interpretation. Human text has a dependency but is not a formula. A change can invalidate its review without overwriting it.

**Unresolved:** notebook versus question desk as the main workspace. They may be alternatives, not additive modes. A notebook helps sequential, reproducible reasoning; a desk may better support many open questions. Prototype both on the same owner task before choosing. The current review button records researcher acknowledgement, not a semantic guarantee that every sentence is correct.

#### 6. Wave rehearsal — reuse with exceptions, not optimism

**Moment:** importing the next tracker wave risks making old preparation and interpretations appear current despite changed meanings.

**Working interaction:** inspect four stages: source, meaning, replay and impact. Wave 5 introduces Q12 code 9. The fixture questionnaire identifies it as don't-know, previously code 97. Record that mapping with its source, then rehearse the recipe. Satisfaction becomes available at 104/200 = 52%; its interpretation needs review. Awareness and consideration stay available because they do not depend on Q12. The working tracker remains on Wave 4 throughout.

**Design bet:** a short staged flow is useful when the order matters, but the default surface should be the exception and affected outputs, not an enormous technical graph. Show the raw value, proposed role, source evidence and consequence together. A successful replay is not the same as a reviewed research conclusion.

**Unresolved:** wording changes, changed routing, split variables, newly introduced response options, changing sample sources and overlapping respondents. Some differences require a series break, not a mapping. A future codebook-assisted suggestion should remain unresolved when evidence is absent or contradictory. This sketch includes one explicit meaning exception, not a general matching system.

### Further ideas worth keeping in the exploration space

These are intentionally not a committed backlog. They extend the borrowed patterns and reveal where the boundaries of a survey-native environment might sit.

| Idea | Concrete researcher action | Why explore it / reason to discard it |
| :--- | :--- | :--- |
| Denominator peel | Expand 240 sampled → 160 eligible → 152 valid → weighted base, with the cause of each difference. | Makes bases explainable; discard the visual treatment if it oversimplifies overlapping exclusion rules. |
| Comparison composer | Pin a measure and wave; choose “show across” from an eligible set of dimensions, with base warnings. | Borrow partial specification from visual exploration research; reject if recommendations create more triage than insight. |
| Questionnaire-aware joins | Preview respondent-key duplicates and the post-join grain before attaching another file. | Prevent accidental respondent multiplication; never hide one-to-many relationships behind a successful join badge. |
| Multiple-response lens | Switch between respondents choosing an option and share of all selections, with the denominator sentence changing. | Exposes an especially consequential survey distinction; keep the two measures separate in saved outputs. |
| Weight impact lens | Inspect which groups gain influence, raw versus weighted bases and effective sample size under stated assumptions. | Makes weighting understandable; not a replacement for design-aware variance estimation or a universal quality score. |
| Quality investigation desk | Compare flagged and unflagged respondents, inspect rule evidence, then stage an exclusion. | Keeps quality detection separate from decisions; reject rules that cannot be explained or audited. |
| Recode by example | Mark source categories and see a proposed net, its code expression and overlap before saving. | Makes transformations direct; prevent disjoint/exhaustive assumptions from being silently inferred. |
| Semantic diff | Compare questionnaire wording, routing, response options and measure definitions between waves. | Can reveal issues invisible to numerical diffs; textual similarity alone must not certify equivalence. |
| Recipe component | Reuse a “brand funnel” with explicit awareness, usage, consideration and universe inputs. | Packages intent rather than UI clicks; defer cross-study generalisation until same-tracker reuse proves useful. |
| Evidence backtrace | From a sentence, inspect its result, definition, preparation steps and raw-source references. | Answers “how did we get here?” without a permanent DAG; guard raw respondent access and output disclosure appropriately. |
| Research checkpoints | Name the state before changing an assumption, then compare results and wording after. | Makes exploration recoverable; avoid forcing researchers to understand Git terminology. |
| Bounded explorable answer | Share an answer with only reviewed population/assumption controls, clearly marking unreviewed combinations. | Lets a reader interrogate the finding; dangerous if prose appears valid under unsupported combinations. |
| Calculation receipt | Attach a compact definition/base/weight/version record to exported evidence. | Carries meaning beyond the app; must complement, not clutter, the presentation. |
| Repair by dependency | Resolve a missing variable once and preview every affected result before rebinding. | Reduces repeated repair; same label must never be sufficient evidence for automatic substitution. |

### What feels coherent, and what should remain separate

The most coherent near-term combination is **microscope → explicit population → evidence-linked answer**. It addresses ambiguity before adding more generated output. The assumption lab is a deeper investigation surface opened when a question warrants it. Wave rehearsal serves repeat-tracker work and could be valuable even if the question-led desk never ships. Measure identity and dependency tracking are shared foundations, not necessarily separate product areas.

The notebook is the strongest alternative to the desk. Do not put both in top-level navigation merely because both prototypes exist. Likewise, a full preparation DAG and a plain-language recipe are competing representations. Show a graph only when branching dependencies themselves are the thing the researcher needs to understand. A universal semantic catalogue, fully autonomous preparation agent and public interactive-report builder are not prerequisites for testing these ideas.

Design taste here means restraint in service of the work: quiet surfaces, readable analytical density, exact labels, one active decision, source context one step away, and very little decorative AI chrome. Preserve the existing neutral Velocity identity. Use colour for selected state or a consequential exception, not a scorecard of artificial certainty. Let typography and spacing distinguish source evidence, computed evidence and human judgement. Avoid a permanent right-hand assistant panel consuming space when no conversation is needed.

### What we can build on, and what is missing

Velocity already has typed categorical codes and labels, transformations, analysis configuration, filters, weights, session persistence, provenance and editable export. These are useful foundations. The sketches must not imply that a new UI alone supplies the missing semantics or dependency behaviour.

| Proposed concept | Existing foundation | Additional contract needed before production |
| :--- | :--- | :--- |
| Microscope | Variable metadata, codes/labels, transformation recipes | Measure-specific response roles, scoped preview using the engine, reversible change provenance |
| Population lens | Filters and analysis configuration | Separate transient inspection selection from persistent population expression; eligible-base explanation |
| Assumption lab | Reusable analysis specification and compute engine | Immutable branch specification, explicit difference, aligned result provenance and comparison limitations |
| Measure studio | Variables, transforms, result provenance | Stable measure identity, version, universe/numerator/denominator definition, correction versus new-estimand distinction |
| Notebook | Existing results, sessions and interpretation work | Explicit dependency fingerprints, selective staleness, preserved prose, reviewed-against version |
| Wave rehearsal | Import, metadata, recipes and sessions | Staged candidate dataset, semantic exceptions, mapping provenance and affected-output rehearsal |

All production computation remains in the existing core/engine/worker boundary. No React or browser state belongs in core. Session additions require a new version and migrations; preserve current v2 reopen behaviour. Hash semantic dependencies as well as numbers: unchanged rounded output does not prove unchanged meaning. A proposed action should be represented as a typed operation with declared scope, preconditions, preview and reversible result. A model may suggest it, but the engine and explicit researcher action determine what changes.

### Next owner explorations and stop signals

1. **Meaning-to-result task:** explain the 46.3% versus 50.0% satisfaction difference and choose a defensible definition. Observe whether the microscope removes codebook hunting and whether the user can explain the retained respondents and changed cells.
2. **Population task:** inspect the younger group, return to the full population, then intentionally analyse the younger group. Observe accidental scope changes, not just task speed.
3. **Sensitivity task:** decide what can be said about the increase after inspecting all three specifications. A good outcome is a qualified interpretation with an unresolved quality diagnostic, not choosing the largest increase.
4. **Notebook versus desk:** perform the same correction and handoff in each. Observe where reasoning is easier to resume, how much review is needed, and whether prose survives intact. Keep the better primary representation rather than merging every feature.
5. **Next-wave task:** resolve code 9 and explain which outputs still need review. Then try a deliberately incompatible wording change in a later prototype. The system should offer a series break, not enthusiastically map everything.

The product owner can perform these directly; no recruitment programme or external approval gate is required. Record mistaken assumptions, corrections, abandoned paths, retrieval steps and review effort. Time savings remain unmeasured. Keep an idea only if it improves a consequential decision or makes a meaningful mistake easier to catch; novelty alone is insufficient.

### Verification and honest limits

The six sketches include working local interactions, computed percentages for the first five, reversible preparation, explicit cohort adoption, comparison/adoption state, separate measure creation, evidence invalidation with preserved prose and staged mapping/replay. Wave rehearsal uses a fixed synthetic replay result rather than a real import engine. Automated DOM checks exercise each complete path and relevant reversals, including independent fixture arithmetic and preservation of text. They do not establish browser layout quality, statistical validity, durable recovery or researcher usability.

The standalone preview and inline fragment share the same source. There are no network API calls or production application changes. All edits disappear on reload. Production CI is not claimed for this documentation/prototype-only change. The earlier browser local-file policy restriction remains; no workaround or new rendered browser inspection is claimed. The prototypes should be treated as tangible hypotheses ready for direct owner use, not released features.

### Broader sources

- **B1:** [OpenRefine: Exploring facets](https://openrefine.org/docs/manual/facets).
- **B2:** [OpenRefine: Exporting data and history](https://openrefine.org/docs/manual/exporting).
- **B3:** [Microsoft: Power Query data profiling tools](https://learn.microsoft.com/en-us/power-query/data-profiling-tools).
- **B4:** [Tableau Prep workspace](https://help.tableau.com/current/prep/en-gb/prep_about.htm).
- **B5:** [Tableau Prep: Copy and reuse steps](https://help.tableau.com/current/prep/en-gb/prep_copy_reuse_steps.htm).
- **B6:** [Dataiku DSS: Visual data preparation](https://doc.dataiku.com/dss/latest/preparation/index.html).
- **B7:** [KNIME Analytics Platform Components Guide](https://docs.knime.com/ap/latest/analytics_platform_components_guide/).
- **B8:** [Hex pivot cells](https://learn.hex.tech/docs/explore-data/cells/transform-cells/pivot-cells) and [input cells](https://learn.hex.tech/docs/explore-data/cells/input-cells/input-cells-introduction).
- **B9:** [marimo: Running cells and reactivity](https://docs.marimo.io/guides/reactivity/) and [FAQ](https://docs.marimo.io/faq/).
- **B10:** [Observable: Reactive dataflow](https://observablehq.com/@observablehq/reactive-dataflow).
- **B11:** [dbt Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl).
- **B12:** [Microsoft Research: Data Formulator 0.7](https://www.microsoft.com/en-us/research/blog/data-formulator-0-7-ai-powered-data-analytics-for-enterprise-data/) and [Data Formulator 2 research](https://www.microsoft.com/en-us/research/publication/data-formulator-2-iteratively-creating-rich-visualizations-with-ai/).
- **B13:** [JMP Public: Interactive features](https://www.jmp.com/support/help/en/19.0/jmppublic/jmppublic.shtml).
- **B14:** [Boba: Authoring and Visualizing Multiverse Analyses](https://idl.uw.edu/papers/boba).
- **B15:** [Voyager 2: Augmenting Visual Analysis with Partial View Specifications](https://idl.uw.edu/papers/voyager2).
