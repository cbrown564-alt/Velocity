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
