# Agent Evaluation: British Social Attitudes 2017

## Research Brief

**Dataset:** `test_data/British Social Attitudes Survey/bsa2017_for_ukda.sav`
**Origin:** NatCen Social Research, 34th wave of Britain's flagship social attitudes survey
**Size:** 3,988 respondents, 654 variables
**Fieldwork:** July–November 2017 (post-Brexit referendum, pre-withdrawal)
**Sample:** Multi-stage stratified random probability sample of adults 18+ in Great Britain

### Background

The British Social Attitudes (BSA) survey has tracked public opinion on social, moral, and political issues since 1983. The 2017 wave was fielded in the year following the EU referendum and covers an extraordinary breadth of topics: political trust, the EU and Brexit, the NHS, welfare and benefits, housing, education, gender equality, transport, disability, and social networks. The questionnaire was split into four versions (A/B/C/D), each asked of ~1,000 respondents, so not all questions were asked of everyone.

The dataset includes pre-computed attitude scales (left-right, libertarian-authoritarian, welfarism) derived from multi-item batteries, plus rich demographic and socioeconomic classifications (NS-SEC social class, party identification, income quintiles, region, religion, ethnicity).

**Critical note:** The dataset includes survey weights (`WtFactor`) that correct for selection probability and non-response. All analyses should be weighted.

### Research Questions

The agent should investigate the following, focusing on 2–3 themes rather than trying to cover everything:

1. **Post-referendum political landscape:** How do attitudes toward the EU, immigration, and national identity break down by party identification, age, social class, and region? Is there a clear "Leave vs Remain" attitudinal divide visible in the cross-tabs?

2. **NHS and health services:** What is the level of public satisfaction with the NHS? Does this vary by age, income, or political alignment? What do people think the government's top spending priority should be?

3. **Welfare attitudes and the welfarism scale:** How do attitudes toward benefits, unemployment, and the welfare state distribute across the population? Is there a class or age gradient? Do people who score high on the welfarism scale also lean left on redistribution?

4. **Trust and institutions:** How much do people trust government, parliament, and the political system? Has the post-referendum environment affected perceived legitimacy? How does trust relate to party identification?

5. **Social liberalism:** How do attitudes on gender equality, sexuality, censorship, and traditional values break down by age and education? Is there a generational divide on the libertarian-authoritarian scale?

### Deliverable

A presentation deck (PPTX) of 12–18 slides organised into 3–4 thematic sections. The agent should select a coherent subset of the 654 variables — not try to analyse everything — and produce a narrative about British public opinion in the year after Brexit. Speaker notes should contextualise findings (e.g., "Younger respondents are significantly more pro-EU, consistent with the known age gradient in the 2016 vote").

---

## Evaluation Framework

### What We Expect the Process to Look Like

1. **Load & orient** (~2 steps): Load the file, call `describe()`. The agent will receive a wall of 654 variables. The first challenge is making sense of the inventory. Variable names follow BSA conventions (capitalised, abbreviated: `Redistrb`, `TaxSpend`, `NHSSat`, `GovTrust`). Labels are usually clear but the sheer volume is the obstacle.

2. **Annotate & search** (~3–5 steps): Run `annotateDataset()`, then use `searchVariables()` to find variables relevant to each research question. This is where semantic search proves its value — or reveals its limits. The agent should search for "EU", "NHS", "welfare", "trust", "immigration" etc. and use the results to identify candidate variables. It may also need `describeVariable()` to inspect specific variables' value labels before deciding to include them.

3. **Identify weight variable** (~1 step): The agent must identify `WtFactor` as the correct survey weight and apply it. The dataset description or annotation should flag it. This is non-optional — unweighted BSA results are methodologically invalid for population inference.

4. **Strategic variable selection** (~2–3 steps): With 654 variables, the agent cannot analyse everything. It must choose 15–25 variables that together tell a story. This is the hardest cognitive task — it requires understanding which variables are substantive attitudes, which are demographics for breaks, and which are derived composites that might be redundant.

5. **Run analyses** (~5–10 steps): Execute cross-tabs with the weight applied. The agent should explore a few key tables first (`resolveLabels: true`), read the results, decide what's interesting, then expand or pivot.

6. **Compose deck** (~1 step): Build a structured `DeckSpec` with thematic sections. Titles should be editorial ("Britain divided: EU attitudes by age") not mechanical ("EUBrld by RAgeCat").

7. **Export & persist** (~2 steps): Export PPTX, commit deck, export session.

### Expected Duration

Total: 15–25 engine calls. Longer than the sleep study because the variable discovery phase requires more iteration. The 3,988 rows won't slow computation, but the 654-variable discovery problem will test the agent's ability to navigate a large unfamiliar dataset.

### Potential Pitfalls

| Risk | Description | Likelihood |
|------|-------------|------------|
| **Variable overload** | 654 variables. The agent might either freeze (unable to choose what to analyse) or scatter (analyse 30 variables superficially rather than 15 deeply). The `describe()` output alone will be enormous. | HIGH |
| **Missing the weight** | `WtFactor` must be applied. If the agent doesn't recognise it or doesn't pass `weightVar` in analysis configs, all results will be unweighted. The annotator should flag it, but the agent needs to act on it. | MEDIUM |
| **Questionnaire versioning** | The sample is split into 4 versions (A/B/C/D). Some variables were only asked of ~1,000 respondents. The agent might not realise that a variable with 75% missing data isn't broken — it was only asked of one version. This could cause confusion or lead the agent to discard valid variables. | HIGH |
| **Derived vs. raw variables** | The dataset has both raw items (e.g., `Redistrb` = single Likert item) and derived scales (e.g., `leftrigh` = composite left-right score). The agent might analyse both, producing redundant slides. Or it might not realise the scales exist and manually analyse individual items when the composite would be more efficient. | MEDIUM |
| **Coded missing values** | BSA uses `8` = "Don't know", `9` = "Refused" as coded values (not system-missing). If the SPSS metadata correctly marks these as user-missing, the engine should exclude them. If not, "Don't know" appears as a substantive category in cross-tabs, distorting results. | MEDIUM |
| **Too many categories** | Some variables have 15+ categories (e.g., `GOR_ID` = 15 regions, `PartyId1` = 14 parties). Cross-tabbing two high-cardinality variables produces a sparse, unreadable table. The agent needs to choose condensed versions (e.g., `PartyId3` with 8 categories rather than `PartyId1` with 14). | MEDIUM |
| **Interpreting scale variables** | The left-right, libertarian-authoritarian, and welfarism scales are continuous (1–5). Cross-tabbing them directly as row or column variables produces sparse tables. They work better as breaks if binned, or as described continuous measures. | MEDIUM |
| **Generic annotations** | With 654 variables and diverse topics, the heuristic annotator will miss most domain-specific content (EU attitudes, NHS satisfaction, political trust). It will correctly identify demographics and some attitude scales via Likert labels, but the search will need to rely heavily on label keyword matching rather than semantic annotation. | HIGH |

### Opportunities We're Hopeful the Agent Will Uncover

| Opportunity | Description |
|-------------|-------------|
| **The Brexit divide** | BSA 2017 is ground zero for understanding post-referendum Britain. If the agent finds EU attitude variables and breaks them by age, party, and class, it should reveal a striking generational and political divide. This is the marquee finding. |
| **NHS as national religion** | NHS satisfaction is typically the most politically salient finding in BSA. If the agent spots `NHSSat` and breaks it by party and income, it should find broad support for the NHS but growing concern about its future — a finding with genuine policy relevance. |
| **Welfare attitudes and class** | The welfarism scale reveals deep tensions in British attitudes toward benefits and personal responsibility. Breaking by NS-SEC class or income could show that welfare scepticism is not purely a working-class phenomenon. |
| **Smart use of `searchVariables()`** | This is the dataset where semantic search should shine. The agent can't read 654 variable labels manually. If it uses queries like "trust government", "EU membership", "NHS satisfaction", "welfare benefits" and gets useful results back, the search feature proves its value at scale. |
| **Weight application** | If the agent correctly identifies and applies `WtFactor` throughout, it demonstrates a methodologically sound workflow — a significant differentiator from naive AI analysis. |
| **Editorial narrative** | BSA data tells a story about a country at a political inflection point. If the agent structures the deck as a narrative (political context → social attitudes → demographic divides) rather than a variable-by-variable dump, that's a sophisticated output. |
| **Variable selection discipline** | The strongest signal of agent quality here is restraint. A good agent analyses 15–20 variables deeply. A poor agent analyses 50 variables shallowly. |

### Expected Outcomes

**Good outcome:** A 12–15 slide deck covering 2–3 themes (e.g., post-Brexit politics + NHS + welfare), weighted using `WtFactor`, with condensed party/region variables, editorial titles, and speaker notes that contextualise findings. The agent navigates the 654-variable landscape without getting lost.

**Great outcome:** The above, plus the agent demonstrates genuine discovery — finding variables via semantic search that it wasn't explicitly directed toward, noticing unexpected patterns in cross-tabs, using `suggestAnalyses()` results to inform its choices, and producing speaker notes that show understanding of the political context (2017, post-referendum). The deck reads like it was produced by a competent analyst, not a query generator.

**Mediocre outcome:** A deck that covers one topic only (e.g., demographics) because the agent couldn't navigate the variable space. Or a deck with 20 slides that are all mechanical cross-tabs with no narrative flow. Or unweighted results throughout.

**Poor outcome:** The agent fails to produce a deck because it gets overwhelmed by 654 variables, or produces tables with "Don't know" as the largest category, or applies the wrong weight variable, or generates slides with 15×14 sparse cross-tabs that are unreadable.

---

## Comparison Value

Running both evaluations on the same engine with the same agent allows direct comparison:

| Dimension | Sleep Study (small) | BSA 2017 (large) |
|-----------|-------------------|-------------------|
| Variable count | 59 | 654 |
| Discovery challenge | Low — can review all variables | High — must search/filter |
| Domain knowledge needed | Moderate (clinical scales) | High (British politics, survey methodology) |
| Weighting | None (trap: body weight ≠ survey weight) | Required (`WtFactor`) |
| Narrative complexity | Single theme (sleep health) | Multi-theme (politics + health + welfare) |
| Annotation coverage | ~51% (health vocabulary) | ~44% (mostly structural, few topic-specific) |
| Expected slides | 8–12 | 12–18 |
| Key test | Handles metric variables, avoids weight trap | Navigates scale, applies weight, selects wisely |
