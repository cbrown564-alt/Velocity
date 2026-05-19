# Agent Evaluation: Sleep Health Study

## Research Brief

**Dataset:** `test_data/sleep.sav`
**Origin:** Teaching dataset from a study on the impact of sleep problems
**Size:** 271 respondents, 59 variables
**Instruments included:** Epworth Sleepiness Scale (ESS), Hospital Anxiety and Depression Scale (HADS)

### Background

A researcher has collected survey data from 271 adults on sleep habits, health self-ratings, mental health (anxiety, depression), and the downstream impact of sleep problems on daily life. The data includes clinical screening instruments (ESS, HADS) alongside self-reported sleep behaviours and demographics.

### Research Questions

The agent should investigate the following, in this priority order:

1. **Sleep quality profile:** What does the distribution of sleep quality look like across the sample? How satisfied are people with their sleep? What proportion report trouble falling asleep, staying asleep, or waking during the night?

2. **Demographic variation:** Do sleep quality, sleepiness (ESS), and satisfaction differ meaningfully by gender, age group, marital status, or education level?

3. **Mental health association:** Is there an observable relationship between anxiety/depression scores (HADS) and sleep quality? Do people with higher anxiety report worse sleep? Does this pattern differ by gender?

4. **Impact of sleep problems:** Among those who report a sleep problem, which life domains (mood, energy, concentration, memory, life satisfaction, well-being, relationships) are most affected? Does the severity of impact vary by anxiety or stress levels?

5. **Lifestyle factors:** Do smokers, heavier drinkers, or higher caffeine consumers report different sleep quality or sleepiness compared to non-users? Is there a night-shift effect?

### Deliverable

A presentation deck (PPTX) of 8–12 slides organised into logical sections that tells a coherent story about sleep health in this sample. The agent should choose which analyses best answer the research questions and structure the deck to build a narrative, not just list tables.

---

## Evaluation Framework

### What We Expect the Process to Look Like

1. **Load & orient** (~2 steps): Load the file, call `describe()` to understand the variable inventory. The agent should recognise this is a health/clinical dataset with a mix of demographics, self-ratings, clinical scales, and impact measures.

2. **Annotate & discover** (~2 steps): Run `annotateDataset()` to classify variables, then use `suggestAnalyses()` to get recommendations. The agent should notice the suggestions point toward attitude × demographic cross-tabs.

3. **Explore & reason** (~3–5 steps): Use `runAnalysis()` with `resolveLabels: true` to inspect key distributions (sleep quality, ESS, satisfaction) and cross-tabs (quality × gender, ESS × age group). The agent should iterate — looking at initial results, forming hypotheses, then running targeted follow-ups.

4. **Compose deck** (~1 step): Build a `DeckSpec` with sections and slides that answer the research questions in narrative order. Should include titles, subtitles, and speaker notes explaining the findings.

5. **Export & persist** (~2 steps): Export PPTX, commit deck to session, export `.velocity` session file.

### Expected Duration

Total: 10–15 engine calls. The dataset is small and loads fast. The bottleneck should be the agent's reasoning about which analyses to run, not compute time.

### Potential Pitfalls

| Risk | Description | Likelihood |
|------|-------------|------------|
| **Metric variable confusion** | `ess`, `anxiety`, `depress` are continuous scores, not categorical. If the agent tries to cross-tab them as row variables without a column break, it'll get one row per unique score (30+ rows). The agent needs to either use them as column variables with categorical rows, or understand that the engine will detect them as metrics. | HIGH |
| **Missing the impact variables** | `impact1`–`impact7` only apply to respondents who said "yes" to having a sleep problem (`sleepprob`). The agent might cross-tab these on the full sample, diluting results with non-applicable respondents. Should filter to `sleepprob = Yes` first. | MEDIUM |
| **Ignoring the weight variable** | `weight` in this dataset is body weight in kg, NOT a survey sampling weight. There is no sampling weight. If the annotator tags it as a sampling weight (it's tagged as `sampling_weight` by name pattern), the agent might incorrectly weight the analyses. | HIGH |
| **Flat distributions** | With only 271 respondents and many 1–10 scales, cross-tabs will have sparse cells. The agent might produce tables that are hard to interpret because counts are spread thin across 10 categories. Collapsing scales (e.g., grouping ESS into low/moderate/high) would help but requires recode — which the agent can do via the engine but may not think to. | MEDIUM |
| **Binary variables as row vars** | `troublefallasleep`, `troublestaysleep`, `wakenite` are yes/no. Cross-tabbing these by demographics produces small 2×N tables that may not be visually compelling. Combining them into a "sleep problems" summary would be better but requires engineering the agent hasn't been prompted to do. | LOW |
| **Limited variable labels** | Some variable names are opaque (`qualsleep4gp`, `hourwknight`). The agent will need to rely on labels from `describe()` to understand them. Labels exist but some are terse. | LOW |

### Opportunities We're Hopeful the Agent Will Uncover

| Opportunity | Description |
|-------------|-------------|
| **Anxiety-sleep nexus** | The strongest story in this data is likely the relationship between HADS anxiety scores and sleep quality/satisfaction. If the agent spots that high-anxiety respondents cluster in "very poor" / "poor" sleep quality, that's a real clinical insight. |
| **Gender patterns** | Sleep research commonly finds gender differences in both sleep quality self-report and anxiety prevalence. If the agent notices and explores this, it demonstrates domain reasoning. |
| **ESS clinical thresholds** | The Epworth Sleepiness Scale has clinical cut-offs (>10 = excessive daytime sleepiness). If the agent uses `describeVariable()` on ESS and notices the distribution, it might structure analysis around clinical groups — though this requires recode capability. |
| **Impact severity gradient** | Among those with sleep problems, the impact variables could reveal that mood and energy are most affected (typically highest in sleep research), while relationships are least affected. This is a nuanced finding that requires filtering + comparative analysis. |
| **Smart chart choices** | For 1–10 scales, horizontal bar charts are more readable than tables. For yes/no × demographics, grouped bars work well. The agent should use `recommendChart()` or make sensible chart type choices in the deck spec. |

### Expected Outcomes

**Good outcome:** A 8–10 slide deck with 3 sections (Sleep Profile, Demographic Patterns, Mental Health Links), sensible chart types, and speaker notes that summarise findings. The agent correctly avoids weighting, handles at least one metric variable appropriately, and the narrative flows logically.

**Great outcome:** The above, plus the agent filters for sleep-problem respondents when analysing impact variables, notices the anxiety-sleep relationship, and produces speaker notes that contain genuine analytical observations (not just "this table shows X by Y").

**Mediocre outcome:** A deck that lists cross-tabs without narrative structure. All tables, no charts. Speaker notes are generic. The agent treats every variable the same way (row × column) without reasoning about which analyses are interesting.

**Poor outcome:** The agent weights the data using the body-weight variable. Or produces tables with 30+ rows from continuous variables. Or fails to produce a deck at all due to variable type errors.
