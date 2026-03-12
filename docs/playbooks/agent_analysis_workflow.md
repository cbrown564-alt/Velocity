# Playbook: Agent Analysis Workflow

Step-by-step procedure for an AI agent analyzing a survey dataset and producing a presentation deck via Velocity MCP tools.

**Pre-requisites:** Read `docs/guide_agent_quickstart.md` for the full tool reference.

---

## Phase 1: Orient (2-3 calls)

### Step 1.1 — Load the dataset

```
velocity_load({ path: "dataset.sav" })
```

Check the response:
- `variableCount` tells you the scale of the discovery problem
- `rowCount` tells you the sample size

### Step 1.2 — Describe the dataset

```
velocity_describe()
```

Skim the response for:
- **Total variable count** — determines how much searching you need to do
- **Variable types** — how many nominal vs. ordinal vs. scale
- **Value labels** — are they present? (SAV files usually have them; CSV files don't)
- **Missing values** — are user-missing codes defined?

**Do NOT try to analyze all variables.** If there are 50+, you must use the semantic layer to navigate.

### Step 1.3 — Identify the weight variable

Scan the variable list for common weight names: `WtFactor`, `weight`, `wt`, `finalwt`, `sampleweight`. If you see one, note it. You'll confirm it in the next phase.

---

## Phase 2: Annotate & Discover (3-8 calls)

### Step 2.1 — Auto-annotate

```
velocity_annotate_dataset()
```

This classifies variables by topic and measurement intent. Check the `annotated` count vs `total` — a 40-50% annotation rate is typical for large surveys.

### Step 2.2 — Confirm the weight variable

```
velocity_search_variables({ query: "weight" })
```

Look for results with `measurementIntent: "weight"`. If found, set it:

```
velocity_set_weight({ variableId: "WtFactor" })
```

**If no weight variable exists**, that's fine — not all datasets are weighted. But if the dataset documentation mentions weights and you can't find one, check for variables with names like `fw`, `w1`, `wt_trim`, etc.

### Step 2.3 — Search for theme variables

Run one search per research theme:

```
velocity_search_variables({ query: "EU membership Europe remain leave", limit: 15 })
velocity_search_variables({ query: "NHS satisfaction health service", limit: 15 })
velocity_search_variables({ query: "welfare benefits unemployment", limit: 15 })
velocity_search_variables({ query: "trust government parliament", limit: 15 })
```

**Strategy:**
- Use 3-5 keywords per search, mixing domain terms and common label words
- Review results for relevance — the relevance score is relative, not absolute
- Note the variable IDs of promising results

### Step 2.4 — Search for break variables (demographics)

```
velocity_search_variables({ query: "age gender sex class education region party", limit: 20 })
```

These are the variables you'll use as column breaks in cross-tabs. Look for:
- Age (preferably categorical/grouped, not continuous)
- Gender/Sex
- Social class, education level, income
- Party identification (prefer condensed versions with fewer categories)
- Region (prefer condensed versions)

### Step 2.5 — Inspect promising variables

For any variable that looks important, run:

```
velocity_describe_variable({ id: "NHSSat" })
```

Check:
- **Distribution** — is it heavily skewed? All in one category?
- **Missing rate** — high missing might mean a split-sample question (not necessarily a problem)
- **N** — is the base large enough for subgroup analysis?
- **Value labels** — do they make sense? Are "Don't know" / "Refused" marked as missing?

---

## Phase 3: Analyze (5-12 calls)

### Step 3.1 — Exploratory cross-tabs

Run a few exploratory analyses to understand the data before committing to a deck structure:

```
velocity_crosstab({
  rowVars: ["NHSSat"],
  colVar: "RAgeCat",
  weightVar: "WtFactor",
  resolveLabels: true
})
```

**Always use `resolveLabels: true`** so you can read the output directly. Without it, you'll see integer codes instead of labels.

### Step 3.2 — Read and interpret results

Look at the cross-tab output for:
- **Large percentage differences** between columns (>10 points is noteworthy)
- **Statistical significance** in `tableStats.chiSquare.pValue`
- **Sample sizes** — are any cells too small (N < 30)?
- **Interesting patterns** — are there age gradients? Party divides? Class effects?

### Step 3.3 — Iterate

Based on what you find:
- Run more cross-tabs with different column breaks
- Try different row variables that might reveal the same pattern
- Search for additional variables that might explain a finding
- Use `velocity_suggest_analyses` for ideas

### Step 3.4 — Optional: Create derived variables

If you need to combine categories:

```
velocity_recode({
  sourceVar: "RAgeCat",
  config: {
    mode: "categorical",
    targetVariableName: "age_3grp",
    label: "Age (3 groups)",
    mappings: { "1": "Young", "2": "Young", "3": "Middle", "4": "Middle", "5": "Older", "6": "Older", "7": "Older" }
  }
})
```

---

## Phase 4: Compose Deck (1-2 calls)

### Step 4.1 — Select your story

Choose 2-3 themes from your exploration. For each theme:
- Pick 3-5 slides that together tell a coherent story
- Start with the biggest finding, then show supporting evidence
- End each section with the most nuanced or surprising result

### Step 4.2 — Build the deck

```
velocity_build_deck({
  spec: {
    title: "Descriptive Title: Subtitle with Context",
    subtitle: "Source: Dataset Name, N = X",
    sections: [
      {
        title: "Section 1: Editorial Theme Title",
        slides: [
          {
            rowVars: ["var1"],
            colVar: "break_var",
            weightVar: "WtFactor",
            title: "Finding-Based Title (Not Variable Names)",
            notes: "Speaker notes explaining the finding, context, and caveats...",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true }
          }
        ]
      }
    ]
  }
})
```

**Slide title rules:**
- State the finding: "NHS Satisfaction Holds Steady Across Income Groups"
- Not the variables: "NHSSat by HIncQurt"
- Use active language: "Young Voters Drive Pro-EU Sentiment"

**Speaker notes rules:**
- First sentence: state the key number
- Second sentence: provide context or comparison
- Third sentence: note caveats (split sample, missing data, small N)
- Optional: suggest implications or follow-up questions

### Step 4.3 — Check the build result

Inspect the `BuiltDeck`:
- `errors[]` — any slides that failed to build?
- `slides[].result.metadata.isWeighted` — is weighting applied?
- `slides[].result.warnings` — any data quality issues?
- `buildDurationMs` — sanity check

---

## Phase 5: Export & Persist (2-3 calls)

### Step 5.1 — Export to PPTX

```
velocity_export_deck({
  deck: <the BuiltDeck from step 4.2>,
  options: { format: "pptx" }
})
```

### Step 5.2 — Export session

```
velocity_export_session()
```

This creates a `.velocity` file that a human can open in the browser to review, refine, reorder slides, and add more analyses.

---

## Common Mistakes to Avoid

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| **Not setting the weight** | All results are unweighted — methodologically invalid for population inference | Search for weight variables immediately after annotation |
| **Using raw codes instead of labels** | Output is unreadable (numbers instead of text) | Always pass `resolveLabels: true` in crosstab calls |
| **Analyzing too many variables shallowly** | 30 slides with no narrative thread | Select 15-25 variables, aim for 12-18 slides |
| **Using high-cardinality variables as columns** | Sparse, unreadable cross-tabs | Look for condensed versions; recode if needed |
| **Ignoring split-sample versioning** | Confusion about high missing rates | Check N via `describe_variable`; ~25% response rate may be normal |
| **Variable-first deck organization** | "Here's Q1 by Q2" instead of "Here's what we found" | Structure by themes and findings, not by variable order |
| **Missing speaker notes** | Deck has no interpretation — just raw tables | Notes are the agent's highest-value contribution |
| **Not checking `metadata.isWeighted`** | Silently running unweighted analyses | Verify after every crosstab or in the BuiltDeck |

---

## Timing Expectations

| Phase | Expected calls | Notes |
|-------|---------------|-------|
| Orient | 2-3 | Load + describe + optional describe_variable |
| Discover | 3-8 | Annotate + 2-5 searches + 1-3 variable inspections |
| Analyze | 5-12 | Exploratory cross-tabs, iteration |
| Compose | 1-2 | Build deck + possibly rebuild after fixing issues |
| Export | 2-3 | Export PPTX + export session |
| **Total** | **15-30** | Larger datasets skew toward the high end |
