# Velocity — Deep Product Profile for Market Research

*Synthesized from five parallel codebase explorations plus primary documentation. Evidence paths are cited throughout. Archived strategy docs are labeled where used; active docs (`docs/tracker_*`, `docs/roadmap_*`, `docs/blue_*`, `AGENTS.md`) take precedence.*

---

## Executive Summary

**Velocity** is a **local-first, browser-native survey analytics workbench** positioned as **"The Anti-SPSS"** and **"Notion for Data."** It targets market researchers who need **Displayr/SPSS-class crosstabs, significance testing, and stakeholder-ready PowerPoint** without cloud upload latency or desktop software friction.

The product is **not commercially launched**: `package.json` shows `version: 0.0.0`, `"private": true`, no release/deploy pipeline. Engineering posture is **post-validation advanced beta** — Phase 4 agent capability evals completed (engine mean **4.7/5**), May 2026 stabilization sprint shipped, and June 2026 structural remediation is underway.

**Two strategic bets:**

1. **Speed + privacy + survey-native correctness** vs Displayr, Q, SPSS
2. **Agent-first analysis** — same `VelocityEngine` powers React UI, CLI, and a ~37-tool MCP server for AI agents building decks and `.velocity` session handoffs

**Category:** Survey analytics / tabulation / crosstab workbench (primary); agentic survey research platform (emerging secondary).

---

## 1. What It Does

### Core job-to-be-done

Open a **SPSS `.sav` or CSV** file in the browser, explore variables, run **instant weighted crosstabs** with **survey-native significance**, build a **multi-slide Analysis Deck**, and export **editable PPTX/XLSX** — with **no data leaving the device**.

### Primary capabilities (shipped)

| Domain | Capability |
|--------|------------|
| **Ingestion** | SPSS `.sav` (ReadStat-WASM), CSV; drag-and-drop; implicit grid detection; multiple-response sets |
| **Analysis** | Crosstabs, banners/stubs, grids, filters, apply existing weights, cell-vs-rest + pairwise significance, Bonferroni/FDR |
| **Visualization** | 15+ chart types (D3); auto chart recommendation; table ↔ chart toggle |
| **Deck** | Multi-slide Analysis Deck; per-slide analysis state; Timeline dock |
| **Export** | Editable PPTX, XLSX; theme-aware branding |
| **Data prep** | Variable sets, recoding (categorical merge + numeric binning), visual ETL drag-merge |
| **Workspace** | OPFS persistence; reopen/switch datasets across sessions; multi-wave projects |
| **Harmonization** | Cross-wave variable matching (Jaro-Winkler); Sankey UI; value remap |
| **Semantic layer** | Heuristic auto-annotation; concept search; break/analysis suggestions (no ML) |
| **Agent surface** | MCP server (~37 tools), CLI, `.velocity` session v2 import/export |
| **Session handoff** | Human ↔ agent sync via session files (metadata + deck, no respondent rows) |

### Explicitly out of scope (today)

- Survey **fielding** (Qualtrics/SurveyMonkey tier)
- **Weight creation / raking** UI (apply-only)
- **SPSS syntax** or full ETL (merge/restructure)
- Complex samples (strata/PSU/TSL)
- MaxDiff, conjoint, TURF, key driver analysis
- Cloud collaboration, realtime multi-user
- Image-only export (rejected — focus on editable PPTX)
- Global "Top 2 Box" toggle (rejected as statistically unsafe)

---

## 2. Who It Is For

### Primary persona (archived but still cited in active docs)

**"Sarah the Strategist"** — senior research exec at a boutique agency. Friday 4 PM, client needs one slide, no SPSS syntax skills, data processing team unavailable. Wants: open `.sav`, drag Gender × Satisfaction, export editable deck.

*Source: `docs/archive/ref_2_mvp_prd.md`, referenced in `docs/blue_02_feature_matrix.md`*

### Implied user segments

| Segment | Need Velocity addresses | Evidence |
|---------|-------------------------|----------|
| **Market researchers / consultants** | Fast crosstabs, significance, PPTX deliverables | Core feature set, glossary, arch_04 |
| **Boutique agency analysts** | Speed, privacy, Mac-friendly, no enterprise license | README, archived market assessment |
| **Freelance / independent researchers** | Affordable alternative to SPSS/Displayr | Archive: `research_07_velocity_market_assessment.md` |
| **Longitudinal / academic analysts** | Cross-wave harmonization, WVS-style studies | Aletheia vision, S5-HARM-1 Done |
| **AI agent operators** | Automated deck building via MCP | Phase 4 evals, `guide_agent_quickstart.md` |
| **Data engineers / cleaners** | Variable Manager for 500+ variables | `design_02_ux_modes.md` |

### UX mode → role mapping

```
Workspace        → dataset librarians, multi-wave study managers
Analysis Canvas  → storytellers, deck builders, stakeholder-facing output
Variable Manager → data engineers organizing/cleaning variables
```

### Documentation gaps for market research

- **No refreshed ICP/persona doc** in active `docs/` — Sarah lives in archive
- **Buyer vs user** (agency principal vs analyst) not segmented
- **Enterprise vs SMB vs academic** not formally defined in live strategy
- **No pricing, licensing, or GTM** in active docs

---

## 3. Value Proposition

### Against incumbents

| vs | Velocity's claim |
|----|------------------|
| **Displayr / Q** | **Instant crosstabs** — zero cloud round-trip latency; data never uploaded |
| **SPSS / WinCross** | Modern web UX; Mac-friendly; no install; privacy on-device |
| **Tableau / Power BI** | **Survey-native methodology** (ESS, cell-vs-rest, weighted stats) — not generic BI math |
| **Image/static exports** | **Editable PPTX** for client deliverables |
| **GUI-only tools** | **Shared engine** for humans and AI agents; provenance on every result |

### Architectural moats (documented)

1. **Local-first privacy** — 100% client-side compute (browser) or local Node (MCP/CLI)
2. **Dual-state data model** — integer codes in DuckDB, labels in metadata; never broken across pipeline
3. **SPSS fidelity** — native SAV, MR sets, grid heuristics, missing-value definitions
4. **Survey-native significance** — Welch's t, cell-vs-rest, Kish ESS vs scipy SRS assumptions
5. **Agent-native architecture** — `ResultEnvelope` provenance, declarative deck specs, MCP as thin transport

### Honest scope limits (active docs)

> *"Velocity is an Analysis tool, not a Processing tool in Phase 2. Users must bring weighted data."*
> — `docs/blue_02_feature_matrix.md`

SPSS is positioned as **complement, not replacement**: Velocity wins on speed and visualization; SPSS wins on syntax, ETL, and deep stats.

### Archive positioning language (historical, influential)

- **"Third way"** between desktop power (SPSS) and cloud collaboration (Displayr)
- **"SPSS power in a Chrome tab"** / **"Figma of Analytics"**
- **"Uncompromising Hybridity"** — browser + Wasm + DuckDB + Arrow

---

## 4. How It Works

### Architecture (four layers)

```
┌─────────────────────────────────────────────────────────┐
│ CONSUMERS (thin transports)                             │
│  React UI  │  CLI (Node)  │  MCP Server (stdio)         │
│  EngineProxy│ VelocityEngine│ VelocityEngine             │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ ORCHESTRATION                                           │
│  VelocityEngine: session, filters, deck, harmonization  │
│  Browser parallel: analysisWorker.ts (calls core direct)│
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ HEADLESS CORE — src/core/ (zero React/DOM)              │
│  ingestion · sql/queryBuilder · analysis · export     │
│  harmonization · semantic · chartRecommender            │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ DATABASE ADAPTER                                        │
│  DuckDB-WASM (browser worker) │ DuckDB Node (CLI/MCP)   │
└─────────────────────────────────────────────────────────┘
```

### Data flow (browser crosstab)

User drags variables → `buildCrosstabRequest` (core) → `EngineProxy.runCrosstab()` → Web Worker → DuckDB SQL via `queryBuilder` → significance in `statistics.ts` → Zustand → `DataTable` / `AnalysisChart`

### Data flow (agent via MCP)

Agent tool call → `mcp-server/tools.ts` → `VelocityEngine.runAnalysis('crosstab')` → `ResultEnvelope` → JSON response → optional `buildDeck` → `exportDeck` (PPTX base64)

### Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 6, Tailwind, Framer Motion, Zustand 5 |
| Database | DuckDB-WASM + DuckDB Node |
| Columnar | Apache Arrow 17 |
| SPSS parsing | ReadStat C → WASM (`packages/readstat-wasm`) |
| Visualization | D3 (custom renderers) |
| Export | pptxgenjs, exceljs |
| Stats (core) | Pure TypeScript |
| Advanced stats (planned) | WebR 0.4, R packages lme4/survey |
| Agent | `@modelcontextprotocol/sdk` |
| Testing | Vitest, Playwright E2E, golden snapshots, Stryker mutation |

### Persistence model

| Store | Location | Contents |
|-------|----------|----------|
| OPFS DuckDB | `velocity_data_v1_dataset_{uuid}.db` | Per-dataset analytical store |
| OPFS source | `uploaded_sav/` etc. | Source replay on corruption |
| localStorage | `workspace.json` | Project/dataset metadata |
| `.velocity` session | File export | Variables, deck, transforms, harmonization — **no respondent rows** |

### Three consumer surfaces

| Surface | Runtime | Maturity |
|---------|---------|----------|
| **Browser app** | React + Worker + DuckDB-WASM | Production UI |
| **MCP server** | Local Node stdio | Eval-validated (~37 tools) |
| **CLI** | Node + DuckDB | Mature (`cli/velocity.ts`) |
| **HTTP REST API** | — | Not implemented |
| **Live Agent Mode** (agent drives browser) | — | Designed, not shipped |

**Known architectural gap:** Browser worker calls `src/core/` directly rather than instantiating `VelocityEngine` — "split-brain" convergence incomplete.

---

## 5. Feature Deep Dive

### Statistical engine

| Capability | Status |
|------------|--------|
| Crosstabs (freq, col %, bases, grids, MR unpivot) | Shipped |
| Apply existing weights + Kish ESS | Shipped |
| Cell-vs-rest significance (Welch's t, 95% CI arrows) | Shipped |
| Pairwise column comparisons (A/B/C letters) | Shipped |
| Multiple testing correction (Bonferroni, FDR) | Shipped |
| Dependent-sample overlap (MR) | Shipped |
| Variable stats / histograms | Shipped |
| SPSS decimal parity (golden tests) | Shipped |
| Weight creation / raking | Planned (Phase 5, WebR) |
| Mixed effects (lme4) | Scaffolded, not productized |
| Complex strata/PSU | Explicit non-goal |

### Chart types (15)

`horizontal-bar`, `vertical-bar`, `grouped-bar`, `grouped-column`, `stacked-bar`, `diverging-bar`, `donut`, `histogram`, `box-plot`, `grouped-box-plot`, `violin`, `ridgeline`, `lollipop`, `scatter`, `hexbin`

Auto-selection via `chartRecommender.ts` with semantic overrides (NPS, demographics, temporal attitude).

### MCP agent workflow (documented)

```
load → describe → annotate → search → analyze → build deck → export deck → commit deck → export session
```

Tool categories: lifecycle, workspace (multi-dataset), introspection, analysis (crosstab with `format: 'matrix'`), deck, harmonization, session, semantic.

### Themes (visual identity)

1. **Soft Machine** (default)
2. **Mission Control** (dark analyst — "Electric Cyan")
3. **Liquid Glass** (presentation)

---

## 6. Where It Is on Its Journey

### Phase map

| Phase | Goal | Status |
|-------|------|--------|
| **Phase 1** | Local-first `.sav` viewer, instant crosstabs | **Done** |
| **Phase 2** | Displayr parity: grids, weights, recoding, PPTX, significance | **Substantially Done** (export polish ongoing) |
| **Phase 3** | Engine convergence, semantic layer, MCP foundation | **Done** |
| **Phase 4** | Agent capability validation | **Done** (follow-through gaps closed May 2026) |
| **Stabilization** | Workspace durability, export quality, CI truthfulness, design tokens | **Done** (May 2026) |
| **Phase 5** | WebR, advanced stats, recipe manager | **Frozen / Not started** |
| **Phase 6** | Deep semantic AI, NL query, Action Hub | **Frozen** |
| **Phase 7** | Realtime collaboration, platform imports | **Frozen** |

### Current posture (June 2026)

**Stabilization before expansion** — not shipping, not expanding into WebR/AI/cloud.

Active work:

- **Thermo-nuclear remediation** — god-file decomposition (Phase 0+1 Done; Phase 2 backlog)
- **UI excellence** — `STAB-UI-A/B/C/E` Done; `STAB-UI-D` (UXR remediation) Not started
- **Structural debt** — 7/7 code areas rated Fail at June audit; layer correction in progress

### Eval validation scores (Phase 4)

| Area | Mean score |
|------|------------|
| Engine (computation, provenance, export, session) | **4.7 / 5** |
| Semantic discovery | **3.0 / 5** |
| MCP workflow breadth | **3.0 / 5** |

Frozen benchmark baselines: EVAL-01 (small deck), EVAL-02 (large survey), EVAL-04 (convergence), EVAL-06 (stress).

### Release posture signals

| Signal | Value |
|--------|-------|
| Version | `0.0.0` |
| npm publish | `"private": true` |
| CI | Typecheck, tests, coverage (80%), build, Playwright E2E, mutation (core only) |
| Deploy pipeline | None |
| ESLint in CI | No |
| Vitest coverage | Excludes `src/features/`, `src/store/slices/` |

**Label for market research:** **Pre-release / internal-advanced-beta** — feature-rich, actively hardening, not GA.

---

## 7. Broader Vision

### Three merged source visions (archive)

1. **Velocity MVP** — speed, drag-and-drop, instant crosstabs
2. **Velocity Strategic** — Displayr commercial parity, variable sets, PPTX
3. **Project Aletheia** — longitudinal/academic, WebR, harmonization, mixed effects

### Long-term roadmap (frozen until Phase 4 follow-through complete)

**Phase 5 — Advanced stats**

- WebR bridge (R in browser worker)
- Mixed effects (lme4), survey-package weighting, raking
- Recipe manager + "time travel" for transform replay
- Syntax drawer (R code for trust/reproducibility)

**Phase 6 — Cognitive engine**

- Semantic reasoning + auto-code for open-ends
- Natural language query (text-to-SQL/text-to-state)
- Action Hub (Linear/Jira export workflows)
- Insight Engine narrative generation
- Infinite canvas mode

**Phase 7 — Cloud platform**

- Realtime collaboration
- Direct imports from Qualtrics, Decipher, etc.
- Living slides / real-time refresh

### Agent-first pivot (architectural, not just feature)

Velocity is evolving from **human analyst tool** to **engine-first platform** where AI agents are co-equal consumers:

- New capabilities ship via `VelocityEngine` + MCP **before** React UI
- `.velocity` sessions are the human↔agent handoff primitive
- Future **"Live Agent Mode"**: agent drives browser; human intervenes ("pair analyst")
- Eval framework treats agent capability as first-class product surface

### Progressive disclosure model (archive)

- **Layer 1 (View):** Open file, see frequencies
- **Layer 2 (Workbench):** Crosstabs, filters, deck, export
- **Layer 3 (Lab/IDE):** R syntax, advanced models, harmonization depth

---

## 8. Competitive Landscape (Documented References)

### Direct competitors named in docs

| Competitor | Relationship | Velocity's angle |
|------------|--------------|------------------|
| **IBM SPSS** | Primary benchmark; complement | Speed, UX, privacy; not full replacement |
| **Displayr** | Primary Phase 2 parity target | Local speed, no upload; PPTX parity |
| **Q Research Software** | Direct MR competitor | ~$3k/yr; banner tables |
| **Crunch.io** | Direct MR competitor | Server latency vs local WASM |
| **AddMaple** | Strategic "cousin" | Local-first, visual EDA |
| **WinCross** | Legacy desktop | Named replacement target |

### Adjacent / not direct

| Category | Players mentioned |
|----------|-------------------|
| Survey fielding | Qualtrics, SurveyMonkey, Medallia, Forsta, Alchemer |
| General BI | Tableau, Power BI |
| AI text analytics | Caplena, Coppelia |
| AI-native analytics | Julius AI, Akkio, Polymer |
| BI-as-code | Evidence, Count, Hex |

### Archive pricing hypotheses (not shipped)

| Model | Source |
|-------|--------|
| Freemium + Pro ~$20–30/mo | `research_07_velocity_market_assessment.md` |
| ~$49/user/mo "seat gap" | `ref_3_strategic_assessment.md` |
| Competitor refs: SPSS ~$99/mo; Displayr ~$3,219/yr | `research_01_competitive_market_assessment.md` |

---

## 9. Comparison Matrix for Market Researcher

Use this as a starting scaffold; external validation required for competitor current-state.

| Dimension | Velocity (documented) | Displayr | SPSS | Q | Tableau |
|-----------|----------------------|----------|------|---|---------|
| **Deployment** | Browser local-first; no server upload | Cloud SaaS | Desktop | Cloud/desktop | Cloud/desktop |
| **Primary format** | `.sav`, CSV | Many + R backend | `.sav` native | `.sav` | Generic |
| **Crosstabs** | Shipped, instant | Core strength | Core, slow UX | Core strength | Manual |
| **Significance** | Survey-native (cell-vs-rest) | Yes | Yes | Yes | Generic |
| **Weight apply** | Shipped | Yes | Yes | Yes | Limited |
| **Weight create** | Delayed (Phase 5) | Yes | Yes | Yes | No |
| **PPTX export** | Shipped (polish ongoing) | Killer feature | Limited | Yes | No |
| **AI agents** | MCP-native (~37 tools) | Emerging AI | No | Limited | Emerging |
| **Harmonization** | Shipped baseline | Yes | Manual | Limited | No |
| **Collaboration** | Not planned (Phase 7) | Yes | No | Yes | Yes |
| **Pricing** | Undocumented | ~$3k+/yr | ~$99+/mo | ~$3k/yr | Varies |
| **Maturity** | Pre-release beta | GA commercial | GA enterprise | GA commercial | GA |

---

## 10. Known Gaps — External Research Questions

Questions the codebase **cannot** answer; a market researcher should investigate:

1. **Commercial entity** — Company, funding, customers, public presence?
2. **GTM / pricing** — Any live pricing page, sales motion, PLG funnel?
3. **Enterprise readiness** — SOC 2, ISO, audit trails, SSO?
4. **Displayr reporting automation** — Live-linked PPT refresh on new waves?
5. **Advanced MR methods** — MaxDiff, conjoint, key driver, TURF at scale?
6. **Qual-quant** — Open-end coding vs Caplena/Coppelia?
7. **PPTX quality** — Stakeholder-ready vs Displayr output (subjective benchmark)?
8. **SPSS migration depth** — Syntax portability, OMS audit logs, merge/restructure?
9. **Market sizing** — "Freelancer gap" is doc hypothesis, not validated data?
10. **Competitive response** — Qualtrics Experience Agents, Displayr AI, AddMaple PLG momentum?
11. **Browser limits** — 4GB WASM ceiling for large trackers?
12. **Weighted mean/stddev bug** — Documented P1 in `arch_04`; parity impact?

---

## 11. Evidence Index

### Authoritative (active docs)

| Path | Contents |
|------|----------|
| `README.md` | Product pitch, quick start |
| `docs/roadmap_00_strategic_guide.md` | Strategy, sequencing, current reality |
| `docs/tracker_00_implementation_status.md` | Execution board, all status labels |
| `docs/blue_02_feature_matrix.md` | Keep/Delay/Reject scope gates |
| `docs/arch_01_system_architecture.md` | System map |
| `docs/arch_02_data_model.md` | Dual-state model |
| `docs/arch_04_statistical_engine.md` | Survey-native methodology |
| `docs/arch_07_agent_architecture.md` | Engine, MCP, session, provenance |
| `docs/design_02_ux_modes.md` | Workspace / Canvas / Variable Manager |
| `docs/guide_agent_quickstart.md` | MCP tool reference |
| `docs/eval_framework.md` | Agent capability scoring |
| `AGENTS.md` | Operating invariants |

### Validation / tests

| Path | Contents |
|------|----------|
| `tests/golden/spss_parity.test.ts` | SPSS decimal parity |
| `tests/golden/` | Golden output regression |
| `tests/parity/` | R reference parity |
| `evals/eval-*/` | Frozen agent benchmark runs |
| `mcp-server/tools.ts` | MCP tool implementations |
| `src/engine/VelocityEngine.ts` | Headless orchestration |

### Archive (market/competitive — historical)

| Path | Contents |
|------|----------|
| `docs/archive/ref_2_mvp_prd.md` | Sarah persona, Friday 4PM test |
| `docs/archive/research_07_velocity_market_assessment.md` | Market structure, PLG hypotheses |
| `docs/archive/research_03_displayr_parity.md` | Displayr gap matrix |
| `docs/archive/research_04_spss_parity.md` | SPSS complement strategy |
| `docs/archive/strategy/blue_01_unified_roadmap.md` | Full phased vision |
| `docs/archive/2026-03/phase4-eval/eval_s4_eval_5_phase_synthesis.md` | Phase 4 validated claims |

---

## Bottom Line for Your Market Researcher

**Velocity is a technically serious, pre-commercial survey analytics workbench** competing on **local speed, privacy, and survey-native statistical rigor** against **Displayr/Q/SPSS**, with a **differentiated agent/MCP layer** that most incumbents lack. The analytical core is **validated** (Phase 4 evals, golden SPSS parity tests); the product is **not market-ready** (0.0.0, private, stabilization/remediation active). Commercial packaging, pricing, ICP refresh, and external market validation are **undocumented gaps** — richest competitive copy lives in `docs/archive/`, not live strategy.

The strategic bet is twofold: win the **"Friday 4 PM crosstab"** moment for boutique researchers, then become the **default engine for AI agents doing survey analysis** — but advanced stats, weight creation, collaboration, and deep AI remain **explicitly frozen** on the roadmap.
