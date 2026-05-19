# Velocity Agent Quick Start

This is the practical reference for AI agents using Velocity's MCP tools. It covers every tool, its parameters, expected outputs, and common patterns. Read this before starting any analysis.

For architecture context, see `arch_07_agent_architecture.md`. For the statistical methodology, see `arch_04_statistical_engine.md`.

---

## 0. Setup

If you are running inside this repository, the intended Claude Code MCP config is already checked in at `.claude/settings.json`.

Before starting analysis:

1. Reload Claude Code after opening the workspace so it picks up `.claude/settings.json`.
2. Run `npm run velocity-mcp-setup` from the repo root.
3. Confirm the script prints a successful MCP initialize handshake and the registered `velocity_*` tools.

If the checked-in config does not load in your Claude Code build, use the same command manually:

```json
{
  "mcpServers": {
    "velocity": {
      "command": "node",
      "args": ["--import", "tsx", "mcp-server/index.ts"],
      "env": { "VELOCITY_DATA_DIR": "/absolute/path/to/your/data/root" }
    }
  }
}
```

`VELOCITY_DATA_DIR` should point to the folder you want `velocity_load` to resolve relative paths against. Using the repo root works well for files under `test_data/`.

---

## 1. Core Workflow

Every agent session follows this sequence:

```
load → describe → annotate → search → analyze → build deck → export deck → commit deck → export session
```

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `velocity_load` | Load a .sav or .csv file (full rows) |
| 1b | `velocity_load_metadata` → `velocity_load_full` | Large SAV: inspect variables first, then load rows |
| 2 | `velocity_describe` | Get the full variable inventory |
| 3 | `velocity_annotate_dataset` | Auto-classify variables by topic and intent |
| 4 | `velocity_search_variables` | Find variables relevant to your research questions |
| 5 | `velocity_crosstab` / `velocity_stats` | Run analyses |
| 6 | `velocity_build_deck` | Compose a presentation from slide specs |
| 7 | `velocity_export_deck` | Export to PPTX or XLSX |
| 8 | `velocity_commit_deck` | Write the built deck into session state |
| 9 | `velocity_export_session` | Save state for human review |

Steps 3-5 are iterative. You will typically search → analyze → search again → analyze more before building the deck.

---

## 2. Tool Reference

### 2.1 Data Lifecycle

#### `velocity_load_metadata` / `velocity_load_full`

Two-step flow for large SAV files (recommended above ~50MB):

1. `velocity_load_metadata` — variable inventory and row count without loading respondent rows into DuckDB.
2. `velocity_load_full` — same path as step 1; materializes full row data for crosstabs and deck building.

Analysis tools return `METADATA_ONLY` until `velocity_load_full` completes.

#### `velocity_workspace_*`

Multi-dataset workspace for cross-wave harmonization (browser-parity path for EVAL-05-style workflows):

| Tool | Purpose |
|------|---------|
| `velocity_workspace_load` | Register a wave/dataset (optional `metadataOnly`, `waveNumber`) |
| `velocity_workspace_list` | List registered datasets |
| `velocity_workspace_set_active` | Switch active dataset for single-dataset tools |
| `velocity_workspace_load_full` | Complete metadata-only workspace entry |
| `velocity_workspace_propose_mappings` | Auto-match variables between two workspace datasets |
| `velocity_workspace_harmonize` | Materialize harmonized table from confirmed mappings |

#### `velocity_load`

Load a dataset into the engine (full row data). Only one **active** dataset drives `velocity_describe` / `velocity_crosstab` at a time; use workspace tools when multiple waves must stay loaded together.

```json
{ "path": "survey_data.sav" }
```

**Returns** `ResultEnvelope<DatasetSummary>`:
```json
{
  "data": {
    "datasetName": "survey_data.sav",
    "rowCount": 3988,
    "variableCount": 654,
    "variableSetCount": 654,
    "source": "sav"
  },
  "operation": "loadFile",
  "durationMs": 1200,
  "warnings": [],
  "metadata": { "datasetName": "survey_data.sav", "rowCount": 3988, "filtersApplied": 0, "isWeighted": false, "engineVersion": "dev" }
}
```

**Notes:**
- Path is relative to the engine's configured `dataDir`, or absolute.
- Supports `.sav` (SPSS) and `.csv` files.
- Loading a new file replaces the current dataset and resets all session state (filters, weight, annotations).

---

#### `velocity_describe`

Get the full dataset description: all variables, variable sets, active filters, and weight.

```json
{}
```

**Returns** `ResultEnvelope<DatasetDescription>`:
```json
{
  "data": {
    "dataset": {
      "id": "dataset-1710288000000",
      "name": "survey_data.sav",
      "rowCount": 3988,
      "variables": [
        {
          "id": "Redistrb",
          "name": "Redistrb",
          "label": "Government should redistribute income from the better off to those who are less well off",
          "type": "ordinal",
          "valueLabels": [
            { "value": 1, "label": "Agree strongly" },
            { "value": 2, "label": "Agree" },
            { "value": 3, "label": "Neither agree nor disagree" },
            { "value": 4, "label": "Disagree" },
            { "value": 5, "label": "Disagree strongly" },
            { "value": 8, "label": "Don't know" },
            { "value": 9, "label": "Refusal" }
          ],
          "missingValues": { "discrete": [8, 9] }
        }
      ],
      "source": "sav"
    },
    "variableSets": [...],
    "folders": [],
    "activeFilters": [],
    "weightVariable": null
  },
  "operation": "describe",
  "durationMs": 0.2,
  "warnings": [],
  "metadata": { "datasetName": "survey_data.sav", "rowCount": 3988, "filtersApplied": 0, "isWeighted": false, "engineVersion": "dev" }
}
```

**This is the most important tool call you will make.** It gives you:
- Every variable's ID, name, human-readable label, type, value labels, and missing values
- Variable sets (grids, multi-response groups)
- Current filter and weight state

**Critical details:**
- Variable IDs are case-sensitive. Use the exact `id` value from `describe()` in all subsequent calls.
- `type` is one of: `nominal`, `ordinal`, `scale` (continuous numeric).
- `valueLabels` maps integer codes to human-readable strings. The raw data in DuckDB uses the integer codes.
- `missingValues.discrete` lists codes that represent missing data (e.g., 8 = "Don't know", 9 = "Refused"). These are excluded from analysis automatically if the SPSS metadata marks them as user-missing.

---

#### `velocity_describe_variable`

Deep dive on a single variable: frequencies, distribution stats, missing breakdown.

```json
{ "id": "NHSSat" }
```

**Returns** `ResultEnvelope<VariableDetail>` with the variable metadata plus computed statistics (counts per value, mean/median/stdDev for numeric variables, missing percentage).

**When to use:** Before including a variable in analysis, to check its distribution and missing rate. Especially useful for large datasets where `describe()` gives you metadata but not statistics.

---

#### `velocity_list_analyses`

List registered analysis types and their config schemas.

```json
{}
```

**Returns** `ResultEnvelope<AnalysisDescriptor[]>` — currently `crosstab` and `variableStats`.

---

### 2.2 Analysis

#### `velocity_crosstab`

The primary analysis tool. Runs a cross-tabulation with optional column break, weighting, filtering, and significance testing.

```json
{
  "rowVars": ["NHSSat"],
  "colVar": "RAgeCat",
  "weightVar": "WtFactor",
  "resolveLabels": true,
  "format": "matrix",
  "analysisSettings": {
    "comparisonMethod": "pairwise",
    "correctionType": "bonferroni",
    "significanceLevel": 0.95
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rowVars` | `string[]` | Yes | Variable IDs for rows. At least one. |
| `colVar` | `string` | No | Variable ID for column break. Omit for frequency table. |
| `filters` | `Filter[]` | No | Per-analysis filters. Falls back to engine's active filters. |
| `weightVar` | `string` | No | Weight variable ID. Falls back to engine's set weight. |
| `resolveLabels` | `boolean` | No | If `true`, replaces raw integer codes in output with human-readable value labels. **Strongly recommended for agent use.** |
| `format` | `"long"` \| `"matrix"` | No | Output shape. Default `"long"` returns one row per cell. `"matrix"` returns a pivot table with column bases and column percentages — preferred for stakeholder artifacts. |
| `analysisSettings` | `object` | No | Significance testing configuration. |

**`analysisSettings` options:**
- `comparisonMethod`: `"cell_vs_rest"` (each cell vs all others) or `"pairwise"` (each column pair)
- `correctionType`: `"none"`, `"bonferroni"`, or `"fdr"` (false discovery rate)
- `significanceLevel`: `0.95`, `0.90`, or `0.80`

**Returns** `ResultEnvelope` wrapping `{ rows, tableStats }`:

Without `resolveLabels`:
```json
{
  "rows": [
    { "rowKey_0": 1, "colKey": 1, "count": 245, "pct": 28.5, "wpct": 27.8 },
    { "rowKey_0": 1, "colKey": 2, "count": 312, "pct": 31.2, "wpct": 30.9 }
  ],
  "tableStats": { ... }
}
```

With `resolveLabels: true`:
```json
{
  "rows": [
    { "rowKey_0": "Very satisfied", "colKey": "18-24", "count": 245, "pct": 28.5, "wpct": 27.8 },
    { "rowKey_0": "Very satisfied", "colKey": "25-34", "count": 312, "pct": 31.2, "wpct": 30.9 }
  ],
  "tableStats": { ... }
}
```

With `format: "matrix"` (recommended for deliverables):
```json
{
  "format": "matrix",
  "columns": [
    { "key": "18-24", "label": "18-24", "base": 860 },
    { "key": "25-34", "label": "25-34", "base": 1000 }
  ],
  "rows": [
    {
      "label": "Very satisfied",
      "cells": {
        "18-24": { "count": 245, "percent": 28.5 },
        "25-34": { "count": 312, "percent": 31.2 }
      }
    }
  ],
  "grandTotal": 1860,
  "tableStats": { ... }
}
```

For metric analysis, each matrix cell also includes the metric fields returned by the crosstab engine, such as `mean`, `stdDev`, `median`, and `validCount`. Weighted matrix requests use weighted bases and counts when a `weightVar` is supplied or a global weight is active.

**Row format:**
- `rowKey_0`, `rowKey_1`, ... — One per row variable (corresponds to `rowVars[0]`, `rowVars[1]`, ...)
- `colKey` — Column variable value (present when `colVar` is set)
- `count` — Unweighted count
- `pct` — Unweighted column percentage
- `wpct` — Weighted column percentage (present when weighted)
- `wcount` — Weighted count (present when weighted)
- `mean`, `stdDev`, `median` — Present for scale/metric variables

**Metric analysis:** If a row variable is `scale` type (continuous numeric), the engine automatically runs metric analysis instead of a frequency cross-tab. Output includes `mean`, `stdDev`, `median`, `min`, `max` broken by column categories.

---

#### `velocity_stats`

Univariate statistics for a single variable.

```json
{
  "column": "WtFactor",
  "variableType": "scale"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `column` | `string` | Yes | Variable ID |
| `variableType` | `string` | No | Override type detection: `nominal`, `ordinal`, `scale` |
| `binCount` | `number` | No | Histogram bins for numeric variables (default: 10) |

**Returns** frequency counts, and for numeric variables: mean, median, stdDev, min, max, quartiles, histogram bins.

---

#### `velocity_sql`

Raw SQL escape hatch. The loaded dataset is in a table called `main`.

```json
{ "sql": "SELECT sex, AVG(age) as avg_age, COUNT(*) as n FROM main GROUP BY sex" }
```

**Notes:**
- Column names in DuckDB are case-sensitive and match the variable IDs from `describe()`.
- Use double quotes around column names: `SELECT "WtFactor" FROM main`.
- Missing values marked in SPSS metadata are stored as the coded integer (e.g., 8, 9), not as NULL. Filter them yourself if needed.
- Useful for ad-hoc exploration, but prefer `velocity_crosstab` for standard analyses since it handles weighting, significance testing, and label resolution.

---

#### `velocity_recode`

Create a new derived variable from an existing one.

```json
{
  "sourceVar": "RAgeCat",
  "config": {
    "mode": "categorical",
    "targetVariableName": "age_group_3",
    "label": "Age (3 groups)",
    "mappings": {
      "1": "Young (18-34)",
      "2": "Young (18-34)",
      "3": "Middle (35-54)",
      "4": "Middle (35-54)",
      "5": "Older (55+)",
      "6": "Older (55+)",
      "7": "Older (55+)"
    }
  }
}
```

**Modes:**
- `categorical`: Map old values to new values via `mappings` (object: old → new)
- `binning`: Bin numeric values via `rules` (array of `{ min, max, label }`)

**Returns** the new `Variable` object. The variable is added to the dataset and available for analysis immediately.

---

#### `velocity_filter` / `velocity_clear_filters`

Add or clear analysis filters. Filters are persistent until cleared.

```json
{
  "filter": {
    "id": "filter-1",
    "variableId": "GOR_ID",
    "operator": "in",
    "value": [1, 2, 3]
  }
}
```

**Operators:** `eq`, `neq`, `in`, `gt`, `lt`

**Value types:**
- `eq` / `neq` / `gt` / `lt`: single value (number or string)
- `in`: array of values

**Notes:**
- Filter values use the raw integer codes from the data, not the label strings.
- Multiple filters are combined with AND logic.
- Filters affect all subsequent `velocity_crosstab` calls unless the crosstab passes its own `filters` parameter.
- Use `velocity_clear_filters` (no parameters) to remove all filters.

---

#### `velocity_set_weight`

Set or clear the survey weight variable.

```json
{ "variableId": "WtFactor" }
```

Pass `null` to clear: `{ "variableId": null }`

**Critical:** Many survey datasets require weighting for valid population inference. Check the dataset documentation or use `velocity_search_variables` with query `"weight"` to find weight variables. The `velocity_annotate_dataset` tool will flag weight variables with `measurementIntent: "weight"`.

---

### 2.3 Semantic Layer

These tools help you navigate large datasets (100+ variables) by meaning rather than name.

#### `velocity_annotate_dataset`

Run heuristic auto-annotation over all variables. Classifies each variable with a topic, measurement intent, and confidence score using pattern-matching rules.

```json
{}
```

**Returns** `{ annotated: number, total: number }` — e.g., `{ annotated: 287, total: 654 }`.

**What it detects:**
- **Weight variables** (confidence 0.95): Names matching `wt`, `weight`, `WtFactor`, etc.
- **Identifiers** (0.9): `respondentId`, `serial`, `caseid`, etc.
- **Demographics** (0.7-0.9): Variables with labels containing "age", "gender", "income", "region", etc., or with gender-specific value labels
- **Attitudes** (0.75-0.9): Likert scales (agree/disagree), satisfaction scales, NPS
- **Behavior** (0.75): Frequency scales (never/rarely/sometimes/often/always)
- **Awareness** (0.8): Aided/unaided awareness labels
- **Health/clinical** (0.65-0.72): Sleep, anxiety, depression, quality of life instruments
- **Open-ended text** (0.8): Non-numeric variables with no value labels

**Limitations:** The annotator uses pattern matching, not ML. It will miss domain-specific content that doesn't match common survey vocabulary. For a BSA-style social attitudes survey, it will catch demographics, Likert scales, and weight variables but likely miss topic-specific annotations (EU attitudes, NHS satisfaction, political trust). You'll need to rely on `velocity_search_variables` (which searches labels and value labels directly) for topic-specific discovery.

**Always call this before `velocity_search_variables`.** Annotations improve search quality by adding topic signals that search can match against.

---

#### `velocity_search_variables`

Find variables by semantic meaning. Searches variable names, labels, topic annotations, concept names/aliases, and value labels.

```json
{ "query": "satisfaction NHS health", "limit": 15 }
```

**Returns** ranked results with relevance scores (0–1):
```json
{
  "data": [
    {
      "variable": { "id": "NHSSat", "name": "NHSSat", "label": "Overall, how satisfied or dissatisfied are you with the way the NHS runs?", ... },
      "datasetId": "dataset-123",
      "relevance": 0.25,
      "matchedOn": ["label", "topic"]
    }
  ]
}
```

**Scoring weights:**
- Concept match: 0.4 (highest — matches against linked concept names and aliases)
- Topic annotation match: 0.3 (matches against auto-annotation topics)
- Label keyword match: 0.2 (matches against variable labels)
- Name match: 0.1 (matches against variable names)
- Value label bonus: +0.05 (if any value label text matches)

**Search strategy for large datasets:**
1. Start broad: `"EU Europe immigration"` to find a cluster
2. Then narrow: `"EU membership remain leave"` to find specific items
3. Use `velocity_describe_variable` on promising results to inspect their distributions
4. Search for demographics separately: `"age gender class region party"` to find break variables

**Tips:**
- Relevance scores are relative, not absolute. A score of 0.25 can still be the best match.
- Use multiple search terms per query to cast a wider net.
- The search is token-based (not semantic embedding). Use the actual words that appear in variable labels and names.
- If searching for a specific topic returns few results, try synonyms or related terms.

---

#### `velocity_suggest_analyses`

Get domain-aware analysis suggestions for a set of variables.

```json
{ "variableIds": ["NHSSat", "RAgeCat", "Redistrb", "WtFactor"] }
```

**Returns** `AnalysisSuggestion[]` with suggested crosstab configurations, rationales, and priority levels. Useful for discovering interesting cross-tabulations you might not have thought of.

---

#### `velocity_suggest_breaks`

After choosing a topic (row) variable, get ranked demographic or thematic column-break candidates.

```json
{ "variableId": "NHSSat", "limit": 5 }
```

**Returns** `BreakSuggestion[]` plus `warnings[]` when the topic variable has issues (e.g. high cardinality, or a weight-like name that is actually a measurement such as body weight in `sleep.sav`). Prefer breaks with scores ≥ 0.5 and ≤ 12 value labels.

---

#### `velocity_list_variables_by_category`

Filter variables by `measurementIntent` (e.g. `"demographic"`, `"attitude"`). More reliable than keyword search for break-variable discovery on large surveys. Run `velocity_annotate_dataset` first.

---

#### Product-default warnings (`warnings[]`)

Several tools now return non-fatal guardrails in the envelope `warnings` array:

| Trigger | Example |
| :--- | :--- |
| Body-weight false positive | Variable named `weight` that is numeric with no value labels — not a sampling weight |
| High-cardinality row | Row variable with > 20 categories — table may be unreadable |
| High-cardinality column | Column break with > 12 categories — prefer a condensed version |
| Continuous row without labels | Numeric variable used as row without value labels |

Check `warnings` on `velocity_crosstab`, `velocity_suggest_breaks`, and `velocity_describe_variable` before committing to an analysis plan.

---

#### `velocity_annotate` / `velocity_create_concept` / `velocity_link_concept` / `velocity_list_concepts`

Manual annotation and concept management tools. Use these when auto-annotation misses something or you want to create higher-level groupings.

`velocity_annotate` — Manually tag a variable:
```json
{
  "variableId": "EUBrld",
  "annotation": {
    "topic": "eu_attitudes",
    "measurementIntent": "attitude",
    "source": "agent",
    "confidence": 1.0
  }
}
```

These are rarely needed in a typical analysis workflow. The auto-annotator + search combination handles most discovery tasks.

---

### 2.4 Deck Building

#### `velocity_build_deck`

Compose a full presentation deck from a declarative specification. Each slide defines an analysis that the engine executes, processes, and packages.

```json
{
  "spec": {
    "title": "BSA 2017: Britain After Brexit",
    "subtitle": "Key findings from the 34th British Social Attitudes survey",
    "sections": [
      {
        "title": "Post-Referendum Political Landscape",
        "slides": [
          {
            "rowVars": ["EUBrld"],
            "colVar": "RAgeCat",
            "weightVar": "WtFactor",
            "title": "Britain Divided: EU Attitudes by Age",
            "notes": "Younger respondents are significantly more pro-EU, consistent with the known age gradient in the 2016 referendum vote. The 18-24 cohort shows 70% support for EU membership vs. 35% among 65+.",
            "visualizationType": "chart",
            "displayOptions": {
              "showSignificance": true,
              "showPercents": true
            }
          },
          {
            "rowVars": ["EUBrld"],
            "colVar": "PartyId3",
            "weightVar": "WtFactor",
            "title": "EU Attitudes by Party Identification",
            "notes": "Labour and Liberal Democrat identifiers overwhelmingly favour EU membership. Conservative identifiers are split, reflecting the party's internal Brexit divide.",
            "visualizationType": "chart"
          }
        ]
      },
      {
        "title": "NHS and Public Services",
        "slides": [
          {
            "rowVars": ["NHSSat"],
            "colVar": "HIncQurt",
            "weightVar": "WtFactor",
            "title": "NHS Satisfaction by Income",
            "notes": "Satisfaction levels are broadly similar across income quintiles, suggesting the NHS remains a universal institution in public perception."
          }
        ]
      }
    ]
  }
}
```

**Returns** `ResultEnvelope<BuiltDeck>`:
```json
{
  "data": {
    "spec": { ... },
    "slides": [
      {
        "spec": { ... },
        "sectionTitle": "Post-Referendum Political Landscape",
        "result": { "data": { "rows": [...], "tableStats": {...} }, "operation": "runAnalysis:crosstab", ... },
        "processed": { ... },
        "resolvedTitle": "Britain Divided: EU Attitudes by Age",
        "resolvedSubtitle": "Weighted · N = 3,988",
        "resolvedChartType": "grouped-bar"
      }
    ],
    "errors": [],
    "buildDurationMs": 2500
  }
}
```

**Key behaviors:**
- Slides execute sequentially (DuckDB is single-connection).
- **Fail-soft:** If one slide fails (bad variable ID, empty data), it's recorded in `errors[]` but other slides still build.
- If `title` is omitted, auto-generated from variable labels (e.g., "NHSSat by RAgeCat").
- If `subtitle` is omitted, auto-generated from filters/weight/N.
- If `chartType` is omitted and `visualizationType` is `"chart"`, the chart recommender picks one.
- Per-slide `weightVar` and `filters` override the engine's global settings. If omitted, inherits from engine state.

**Speaker notes** are the highest-value feature for agent-generated decks. They become PPTX speaker notes (visible in presenter view). Use them to explain findings, note caveats, and provide context. Write them as if briefing a colleague.

---

#### `velocity_export_deck`

Export a built deck to PPTX or XLSX format.

```json
{
  "deck": { ... },
  "options": { "format": "pptx" }
}
```

**Parameters:**
- `deck`: The `BuiltDeck` object returned by `velocity_build_deck` (pass the `.data` field from the ResultEnvelope)
- `options.format`: `"pptx"` or `"xlsx"`
- `options.branding`: Optional branding overrides

**Returns** `ResultEnvelope` with `data` containing `{ format, base64, byteLength }`. The file content is base64-encoded.

**PPTX structure:**
- Title slide with deck title and subtitle
- Section divider slides for each section
- One slide per analysis with title, subtitle, data table/chart, and speaker notes

---

#### `velocity_commit_deck`

Commit a built deck into the engine session so `velocity_export_session` includes the deck's slides and sections.

```json
{
  "deck": { ... }
}
```

**Parameters:**
- `deck`: The `BuiltDeck` object returned by `velocity_build_deck` (pass the `.data` field from the ResultEnvelope)

**Returns** `{ ok, committedSlides, committedSections }`.

**Important:** `velocity_build_deck` is pure. If you skip `velocity_commit_deck`, the exported `.velocity` file will contain dataset state and semantic state, but not the deck you just built.

---

#### `velocity_recommend_chart`

Get a chart type recommendation for given variables.

```json
{ "rowVarIds": ["NHSSat"], "colVarId": "RAgeCat" }
```

Returns the recommended chart type based on variable types and cardinality.

---

### 2.5 Session Management

#### `velocity_export_session`

Export the complete engine state as a `.velocity` session file (JSON).

```json
{ "outputPath": "evals/eval-03/runs/run-2026-03-12/artifacts/session" }
```

The session captures: dataset metadata, variables, variable sets, transforms, filters, weight, slides, sections, and semantic state. A human can open this in the browser to review and refine the agent's work.

**Behavior:**
- With no `outputPath`, the tool returns `ResultEnvelope<VelocitySessionFile>`.
- With `outputPath`, the MCP server writes the JSON file directly, adds `.velocity` if needed, and returns the same envelope plus the resolved `outputPath`.
- To include a built deck in the session file, call `velocity_commit_deck` first.
- The session contains analysis state and metadata only. It does **not** contain respondent rows or the raw SAV/CSV data file.

#### `velocity_import_session`

Restore state from a previously exported session.

```json
{ "session": { ... } }
```

---

## 3. The ResultEnvelope

Every data-returning tool wraps its result in a `ResultEnvelope`. State-mutation helpers like `velocity_filter`, `velocity_clear_filters`, and `velocity_set_weight` return `{ "ok": true }`.

```json
{
  "data": { ... },
  "operation": "runAnalysis:crosstab",
  "inputs": { "rowVars": ["NHSSat"], "colVar": "RAgeCat" },
  "durationMs": 150,
  "warnings": ["Variable 'NHSSat' has 12.3% missing values"],
  "metadata": {
    "datasetName": "bsa2017_for_ukda.sav",
    "rowCount": 3988,
    "filtersApplied": 0,
    "isWeighted": true,
    "engineVersion": "dev"
  }
}
```

**Always check:**
- `warnings[]` — Non-fatal issues like high missing rates
- `metadata.isWeighted` — Confirm weighting is applied when expected
- `metadata.filtersApplied` — Confirm expected filter count

---

## 4. Error Handling

Errors are returned as `VelocityError` objects with structured codes:

| Code | Meaning | Recovery |
|------|---------|----------|
| `NO_DATASET_LOADED` | Called an analysis tool before `velocity_load` | Load a dataset first |
| `INVALID_VARIABLE` | Variable ID doesn't exist | Check `describe()` for valid IDs. The error's `details.available` lists all valid IDs. |
| `ANALYSIS_FAILED` | Crosstab or stats computation failed | Check variable types and data availability |
| `FILE_LOAD_FAILED` | Could not read the data file | Check path and file format |
| `UNSUPPORTED_FORMAT` | File is not .sav or .csv | Only SAV and CSV are supported |
| `DECK_BUILD_FAILED` | One or more slides failed to build | Check `errors[]` in the BuiltDeck for per-slide failures |
| `PATH_TRAVERSAL_DENIED` | Path contains `..` or escapes dataDir | Use simple filenames or paths within dataDir |

---

## 5. Common Patterns

### 5.1 Finding and Setting the Weight Variable

```
1. velocity_annotate_dataset()
   → Look for annotations with measurementIntent: "weight"

2. velocity_search_variables({ query: "weight" })
   → Confirm the weight variable

3. velocity_set_weight({ variableId: "WtFactor" })
   → Applied to all subsequent analyses
```

Alternatively, pass `weightVar` directly in each `velocity_crosstab` or `velocity_build_deck` slide spec.

### 5.2 Navigating Large Datasets (100+ Variables)

```
1. velocity_describe()        → Skim variable count, types
2. velocity_annotate_dataset() → Auto-classify
3. velocity_search_variables({ query: "topic A" })  → Find theme variables
4. velocity_search_variables({ query: "topic B" })
5. velocity_search_variables({ query: "demographics" }) → Find break variables
6. velocity_describe_variable({ id: "promising_var" }) → Check distributions
7. Select 15-25 variables for analysis
```

### 5.3 Watch Out For

- Semantic search is strong for topic queries, not category-level navigation. Use `velocity_describe()` plus name/label patterns to find demographics and break variables.
- `velocity_describe()` returns the full variable inventory. On 500+ variable datasets, search first and only inspect promising candidates in detail.
- Some surveys use split-sample questionnaire versions. Seeing ~75% missing on one variable can be normal rather than a broken import.

### 5.4 Dealing with Questionnaire Versioning (Split Samples)

Some surveys (like BSA) split the sample into versions (A/B/C/D), where each question is asked of only ~25% of respondents. This means many variables will show ~75% missing data. This is **not** an error — the variable is valid, just asked of fewer people.

Use `velocity_describe_variable` to check the N for any variable before panicking about missing rates. If a variable has ~1,000 valid responses out of 4,000 total, it's likely a version-specific question and perfectly usable.

### 5.5 Choosing Condensed Variables

Many datasets include both detailed and condensed versions of the same variable:
- `PartyId1` (14 categories) vs. `PartyId3` (8 categories)
- `GOR_ID` (15 regions) vs. `GOR3` (3 regions)

**Always prefer the condensed version for cross-tabs.** High-cardinality cross-tabs produce sparse, unreadable tables. Search for both variants and choose the one with fewer categories.

### 5.6 Scale Variables in Cross-tabs

Continuous scale variables (left-right scores, age in years, composite indices) produce sparse tables when used as row or column variables in frequency cross-tabs. Instead:
- Use them as the **row variable** — the engine automatically runs metric analysis (mean, median, stdDev) broken by column categories
- Or recode them into bins first using `velocity_recode` with `mode: "binning"`

### 5.7 Exploratory Analysis Before Deck Building

Before composing your deck, run a few exploratory `velocity_crosstab` calls with `resolveLabels: true` to understand the data. Read the results, decide what's interesting, then build the deck around findings — not around variables.

Good deck narrative: "Here's what we found about public attitudes" (findings-first)
Bad deck narrative: "Here's variable Q1 by Q2, then Q3 by Q4" (variable-first)

---

## 6. Deck Composition Best Practices

### Structure
- **12-18 slides** organized into 3-4 thematic sections
- Each section tells part of a story; the deck tells the whole story
- Section titles should be editorial: "Britain Divided: The Post-Referendum Landscape"
- Slide titles should state the finding: "NHS Satisfaction Remains High Across Income Groups"

### Speaker Notes
- Contextualize the numbers: "This 15-point gap between age groups is consistent with known demographic patterns in the 2016 referendum vote"
- Note caveats: "This question was asked of version A only (N ≈ 1,000), so subgroup analyses should be interpreted cautiously"
- Suggest implications: "The finding that welfare scepticism crosses class boundaries challenges the common narrative"

### Variable Selection Discipline
- A 654-variable dataset does not need 654 analyses
- Select 15-25 variables that together tell a coherent story
- Demographics for breaks (age, gender, class, party, region): 5-8 variables
- Substantive attitudes for rows: 10-15 variables
- Weight variable: 1

### Weight Application
- Set the weight once via `velocity_set_weight`, OR
- Pass `weightVar` in every slide spec (more explicit, recommended for decks)
- Always verify `metadata.isWeighted: true` in results

---

## 7. Crosstab Output Format Reference

### Frequency Cross-tab (categorical row × categorical column)

```json
{
  "rows": [
    { "rowKey_0": "Agree strongly", "colKey": "18-24", "count": 45, "pct": 22.5, "wpct": 21.8, "wcount": 43.2 },
    { "rowKey_0": "Agree strongly", "colKey": "25-34", "count": 62, "pct": 18.7, "wpct": 19.1, "wcount": 63.5 }
  ],
  "tableStats": {
    "chiSquare": { "value": 45.2, "df": 20, "pValue": 0.001 },
    "base": { "unweighted": 2500, "weighted": 2487.3 }
  }
}
```

### Metric Analysis (scale row × categorical column)

When `rowVars` contains a scale variable, the engine computes means instead of frequencies:

```json
{
  "rows": [
    { "colKey": "18-24", "mean": 3.2, "stdDev": 1.1, "median": 3.0, "count": 200, "wcount": 198.5 },
    { "colKey": "25-34", "mean": 3.8, "stdDev": 0.9, "median": 4.0, "count": 350, "wcount": 347.2 }
  ]
}
```

### Frequency Table (row only, no column)

When `colVar` is omitted:

```json
{
  "rows": [
    { "rowKey_0": "Very satisfied", "count": 890, "pct": 100, "wpct": 100, "wcount": 882.3 }
  ]
}
```

### Multiple Row Variables

With `rowVars: ["NHSSat", "Region"]`, rows have `rowKey_0` (NHSSat values) and `rowKey_1` (Region values).
