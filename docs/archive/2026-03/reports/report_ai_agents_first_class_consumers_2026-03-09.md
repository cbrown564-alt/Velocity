# AI Agents As First-Class Consumers: Codebase Evaluation

**Date:** March 9, 2026
**Project:** Velocity
**Scope:** Full codebase review from the perspective of AI agents as product consumers

## Executive Summary

Velocity is already partway to being agent-usable, but primarily as an internal engine rather than as a first-class product surface. In its current state, it is roughly:

- `6/10` for developer-operated agents
- `2-3/10` for autonomous product-facing agents

The main reason the score is not lower is that the codebase already contains several strong foundations:

- a real headless core under `src/core/*`
- a typed worker protocol
- a Node CLI
- portable session/export artifacts
- plugin-style analysis runners
- pure harmonization logic

The main reason the score is not higher is that the app surface is still dominated by:

- human UI gestures
- implicit state transitions
- browser-only persistence assumptions
- a large orchestration layer in `src/App.tsx`
- incomplete parity between planned advanced capabilities and fully executable runtime contracts

The conclusion is that the pivot is viable, but the correct move is not merely adding a chat UI. The architecture needs to shift toward commands, artifacts, provenance, and semantic/domain objects that both humans and agents can use.

## Method

This evaluation reviewed the repository structure, app entry points, state model, worker protocol, core runtime, CLI, workspace model, session/export pipeline, harmonization flow, WebR integration, and architecture docs.

Verification performed:

- Reviewed repository structure and major docs
- Inspected core runtime paths and cross-layer boundaries
- Checked architectural seams for headless reuse
- Ran `npm run typecheck` successfully

Not performed:

- Full test suite run
- E2E/manual interaction testing

## High-Level Assessment

### What Velocity already does well for agents

Velocity already has a meaningful machine-usable substrate:

- `src/core/*` is genuinely portable and browser-independent
- the worker protocol is typed and broad enough to expose real functionality
- the CLI already gives a headless execution path
- sessions are portable serialized artifacts rather than transient UI state only
- slide state and workspace state are explicit enough to become agent-addressable objects
- harmonization includes pure matching logic and worker-executed materialization

This is materially better than most UI-first analytics applications, where "AI support" usually means bolting an LLM onto fragile DOM automation.

### What Velocity currently optimizes for instead

Despite those strengths, the product is still architected around human usage:

- drag-and-drop variable placement
- modal-driven workflows
- implicit analysis execution on state mutation
- browser storage concerns mixed into app behavior
- per-view orchestration logic concentrated in React and Zustand

This means an AI agent can reuse the engine, but cannot yet act as a first-class user of the product without either:

- driving the UI indirectly, or
- bypassing the product surface and talking to lower-level runtime seams

## Current Agent Usability

### 1. Headless core: real strength

The strongest architectural asset is the extracted headless core.

Relevant files:

- `src/core/DatabaseAdapter.ts`
- `src/core/analysis/crosstabRunner.ts`
- `src/core/analysis/AnalysisRunner.ts`
- `src/adapters/DuckDBNodeAdapter.ts`
- `docs/arch_03_headless_core.md`

Observations:

- The database is abstracted behind `DatabaseAdapter`
- Core analysis logic is expressed as portable functions/runners
- The worker is a thin shell around core logic
- A Node adapter exists and is operational

This is exactly the seam an agent-first product would want. It means the analytical engine is not trapped in the browser UI.

### 2. Typed worker protocol: strong foundation, wrong abstraction level

Relevant files:

- `src/types/worker.ts`
- `src/services/analysisWorker.ts`

The worker protocol is already a real machine contract with operations for:

- dataset loading
- schema inspection
- crosstabs
- variable stats
- Arrow export
- generic analysis runner execution
- harmonization table building
- respondent overlap

This makes the system programmatically accessible.

However, this protocol is still too low-level to be the final product interface for agents. It is a runtime transport contract, not a domain command contract.

An agent should be calling:

- `create_analysis`
- `update_slide`
- `apply_filter`
- `harmonize_waves`
- `export_report`

Not low-level worker messages directly.

### 3. CLI: credible current agent surface

Relevant file:

- `cli/velocity.ts`

The CLI is the most usable agent-facing surface today.

It already supports:

- `load`
- `schema`
- `query`
- `stats`
- `analyze`
- `sql`
- `export`

This means a coding agent or automation can already operate Velocity headlessly in a deterministic way.

Limitations:

- it is still analysis-engine centric, not workspace/product centric
- it does not expose full app concepts like slides, projects, sessions, or guided workflows
- some advanced analysis paths remain partial

### 4. Sessions and exports: one of the best agent-ready surfaces

Relevant files:

- `src/core/session/sessionTypes.ts`
- `src/core/session/sessionExporter.ts`
- `src/core/session/sessionImporter.ts`
- `src/core/export/index.ts`
- `src/core/export/types.ts`

This is a major strength.

Velocity already has portable artifacts for:

- analysis/session state
- slides and sections
- workspace snapshots
- harmonization session payloads
- PPTX/XLSX export configuration

These artifacts are exactly the kind of thing agents need:

- stable serialized state
- replayability
- inspectability
- auditability

The session file format is especially important because it can become the sync primitive and agent handoff primitive for future architectures.

### 5. Slides and deck state: promising but UI-coupled

Relevant files:

- `src/types/slides.ts`
- `src/store/slices/slidesSlice.ts`
- `docs/design_04_analysis_deck.md`

Slides are a good early artifact model:

- analysis state
- title/subtitle
- visualization choice
- layout mode
- cells
- sections

This is useful for agents because it turns exploratory analysis into addressable narrative objects.

The problem is that slide state changes are still tightly coupled to UI state restoration behavior. In particular:

- switching slides snapshots current store state
- restoring a slide mutates live app state
- analysis execution is still entwined with view switching

That is acceptable for a human workflow, but it is not a clean command model.

### 6. Harmonization: unusually agent-friendly

Relevant files:

- `src/core/harmonization/matchEngine.ts`
- `src/core/harmonization/harmonizationQueries.ts`
- `src/store/slices/harmonizationSlice.ts`

This part of the product is especially promising for agent use.

Why:

- the scoring logic is pure and testable
- it exposes explicit mappings and warnings
- the work product is a materialized harmonized table
- there is already a reviewable session object

An agent could realistically:

- propose mappings
- rank confidence
- explain type/value-label mismatches
- generate a harmonized output table
- hand uncertain mappings back to the human

This is very close to a real human-agent collaborative workflow already.

## What makes the current app hard for AI agents

### 1. Gesture-first interaction model

Relevant files:

- `src/components/common/DropZone.tsx`
- `src/features/dashboard/components/DraggableVariable.tsx`
- `src/App.tsx`

The main analysis canvas is built around drag-and-drop variable assignment and spatial UI affordances.

This is effective for humans and poor for agents.

An agent should not need to reason in terms of:

- droppable zones
- drag source identity
- collision detection
- sidebar-vs-shelf drag semantics

Those are presentation mechanics, not domain operations.

### 2. Implicit side effects in state changes

Relevant file:

- `src/store/slices/analysisSlice.ts`

For example:

- `setTableConfig()` immediately triggers `runAnalysis()`
- filter mutation methods also trigger analysis

This is convenient in a responsive UI, but poor for deterministic orchestration. It makes it harder for an agent to:

- stage multiple changes
- preview intent before execution
- batch operations atomically
- reason about when analysis should or should not run

An agent-first system wants explicit commands and explicit execution boundaries.

### 3. React/UI orchestration is too central

Relevant file:

- `src/App.tsx`

`src/App.tsx` contains a large amount of orchestration logic for:

- persistence
- worker init
- file upload
- OPFS state
- workspace registration
- session import/export
- dataset switching
- cross-wave flows
- restore/discard prompts
- modal visibility and transitions

This is a sign that the application service layer is still embedded in the UI shell.

For first-class agent consumption, most of this needs to move out into reusable application services.

### 4. Browser storage concerns leak into product behavior

Relevant files:

- `src/store/slices/dataSlice.ts`
- `src/services/opfsFileManager.ts`
- `src/App.tsx`

The current app has product behavior intertwined with:

- OPFS availability
- `localStorage`
- persistence prompts
- storage quota
- browser restore flows

That is appropriate for a local-first browser app, but it means the domain model is not yet cleanly separated from storage/runtime environment concerns.

Agents should operate on workspace and dataset concepts, not on browser persistence edge cases.

### 5. Dataset switching is not fully complete

Relevant files:

- `src/App.tsx`
- `src/features/workspace/hooks/useWorkspace.ts`

There are still TODOs and incomplete flows around dataset switching and OPFS-backed reopening.

This matters because first-class agents need stable workspace navigation:

- open dataset A
- derive something
- switch to dataset B
- compare
- return to A

If that lifecycle is incomplete for humans, it is not ready for autonomous agents.

### 6. Semantic layer is mostly absent

Relevant files:

- `src/types/index.ts`
- `docs/arch_02_data_model.md`

`semanticType` exists on `Variable`, which is good, but it is mostly just latent schema preparation.

There is not yet a meaningful semantic/domain layer for:

- variable intent
- concept linking across waves
- text/open-end semantics
- business/domain ontology
- explainable agent reasoning over the dataset

Without this, agents must infer too much from variable names, labels, and value labels.

### 7. Some advanced agent-relevant paths are still partial

Relevant files:

- `src/core/analysis/runners/SurveyWeightingRunner.ts`
- `src/core/analysis/runners/MixedEffectsRunner.ts`
- `src/store/slices/webrSlice.ts`

These runners currently generate R code / placeholders or rely on higher-level orchestration, rather than exposing one fully unified execution path.

That means the system is not yet uniformly "callable" by an agent with the same ergonomics across all analysis types.

## What first-class AI consumption would look like

If agents became first-class consumers, they would not primarily use the existing UI through simulation. Instead, Velocity would expose a shared domain/application layer for both humans and agents.

That would likely look like this:

### A. Command layer

An explicit command API over the domain:

- `loadDataset`
- `listVariables`
- `createAnalysis`
- `updateAnalysis`
- `runAnalysis`
- `createSlide`
- `setSlideNarrative`
- `createProject`
- `openHarmonizationSession`
- `applyMappings`
- `exportDeck`

### B. Addressable artifacts

Every meaningful object becomes machine-addressable:

- workspace
- project
- dataset
- concept
- variable set
- analysis
- slide
- export job
- harmonization session

### C. Provenance and auditability

Every agent action should emit:

- the command
- the inputs
- warnings
- result artifacts
- execution metadata
- reproducibility hooks

This is especially important in survey analysis, where defensibility matters.

### D. Shared glass-box state

Agent work should materialize into ordinary Velocity objects:

- shelves/config
- filters
- slides
- mappings
- exports

The user should be able to see and edit the same underlying state, not inspect a separate black-box agent output.

### E. Capability discovery

The app should be able to declare machine-readable capabilities:

- supported analyses
- required schemas
- dataset constraints
- output types
- confidence/validation rules

The `configSchema` field on analysis runners is already the beginning of this.

## Architectural changes required

### 1. Introduce an application service layer

Today, important orchestration lives in React components and store slices.

You need a layer between UI and runtime that owns domain commands and workflows.

Responsibilities:

- execute commands
- validate state transitions
- orchestrate multi-step workflows
- normalize results
- emit events/jobs/status

Both the UI and an agent surface would call this layer.

### 2. Move from implicit store mutation to explicit commands

Today:

- mutating config often auto-runs work
- view state and domain state are entangled

Needed:

- explicit `prepare`
- explicit `commit`
- explicit `execute`
- explicit result payloads

This would let agents stage intent and would also improve human UX for complex changes.

### 3. Build a product-level API over the worker protocol

The worker protocol is useful, but too low-level.

Needed:

- a domain API above worker messages
- transport independence
- normalized error handling
- stable result envelopes

The worker should remain an execution backend, not become the user-facing product contract.

### 4. Separate storage adapters from product truth

OPFS and `localStorage` should be implementation details.

Needed:

- workspace/domain state independent of browser persistence mechanics
- adapters for browser local-first, CLI, and future remote/sync modes
- replayable command/event history or artifact state that can be persisted anywhere

### 5. Promote session artifacts to core contracts

The session system is already close to what you need.

Next step:

- treat sessions and related serialized artifacts as official interop contracts
- version them carefully
- make them the basis for agent handoff, sync, automation, and reproducibility

### 6. Introduce semantic/domain entities above raw variables

Current variable metadata is not enough for first-class agents.

Needed entities likely include:

- `Concept`
- semantic variable families
- text/open-end annotations
- wave-crossing identity links
- domain tags

This would let agents reason in more human-relevant terms than raw column ids.

### 7. Unify advanced execution paths

All analysis capabilities should become uniformly executable through one contract.

Currently there is inconsistency between:

- DuckDB-native execution
- worker orchestration
- WebR-backed execution
- placeholder/generate-code paths

Agents need reliable execution semantics, not a mix of real execution and deferred scaffolds.

## Capabilities an agent-first Velocity could enable

If the above architecture were in place, Velocity could support:

### 1. Natural-language to auditable analysis

Example:

> "Compare satisfaction by region among weighted respondents and turn it into a slide."

Output would not be a black-box chart. It would become:

- analysis config
- resolved variables
- filters
- resulting table/chart
- a new slide
- reproducible state

### 2. Autonomous exploratory analysis

Agents could:

- scan for meaningful cuts
- suggest segments with notable divergence
- identify candidate storylines
- generate provisional decks

### 3. Agent-assisted harmonization

Especially strong fit.

Agents could:

- propose mappings
- flag weak matches
- suggest canonical recodes
- create harmonized tables
- produce a review queue for humans

### 4. Automated report generation

Using slides + exports + sessions:

- build deck from saved analyses
- generate PPTX/XLSX on schedule
- maintain morning briefs
- create client-ready baseline narratives

### 5. Programmable research workflows

For example:

- ingest data
- run standard cuts
- generate summaries
- export deliverables
- emit downstream actions

### 6. Human-agent collaborative editing

Because state would stay glass-box and editable:

- the agent drafts
- the human corrects
- the agent iterates

This is much more plausible for survey work than fully autonomous black-box analysis.

## Negative consequences of the pivot

This pivot would produce real costs and risks.

### 1. Architectural complexity rises substantially

You would no longer be building only:

- a UI
- an engine

You would also be building:

- a domain API
- an artifact model
- a workflow/runtime layer
- a provenance/audit surface

### 2. Product ambiguity risk

There is a risk of building an "agent platform" that weakens the human-first experience if abstractions leak upward into the UI.

The right move is shared underlying commands/artifacts, not forcing humans to think like agents.

### 3. Trust and correctness burden increases

Survey analysis is not forgiving.

An incorrect agent action in:

- weighting
- recoding
- harmonization
- interpretation

can produce bad research conclusions.

That means:

- provenance
- confidence signaling
- reviewability
- explainability

are mandatory, not optional.

### 4. Performance pressure increases

Autonomous or semi-autonomous agents will generate many more candidate analyses than humans.

That creates pressure on:

- query throughput
- caching
- job scheduling
- result storage
- artifact management

### 5. Governance and privacy complexity grows

If agents remain entirely local, risk is lower.

If agents:

- call external APIs
- sync remotely
- interact with third-party systems

then governance, privacy, and compliance requirements increase sharply.

### 6. Maintenance burden increases

Every capability now has to work across:

- UI
- worker
- CLI
- sessions
- exports
- future agent API

This makes weak abstractions and stale docs much more expensive.

## Recommended direction

The pivot is viable, and Velocity is better positioned for it than most apps because the headless core is already real.

The recommended sequence is:

### Phase 1: Formalize shared command/artifact layer

Do not start with chat.

Start with:

- command API
- stable artifact model
- explicit workflow execution
- provenance envelopes

### Phase 2: Make human UI consume the same layer

Refactor the React app so the UI is also just a client of that command/artifact layer.

This reduces divergence between human and agent pathways.

### Phase 3: Expose agent-facing interfaces

Then add:

- richer CLI/automation commands
- machine-readable capability discovery
- structured prompt/tool interfaces
- replayable work products

### Phase 4: Add semantic and natural-language layers

Only after the underlying domain model is strong:

- text-to-analysis
- semantic reasoning
- open-end coding
- action hubs

## Final judgment

Velocity is not currently an agent-first product, but it is already much closer to one than most analytics apps because the engine, session model, and some artifact surfaces are real.

The pivot would be credible if approached as:

- architecture-first
- artifact-first
- glass-box by default

It would be a mistake if approached as:

- "add chat"
- "let the LLM drive the UI"
- "treat the worker protocol as the product API"

The correct strategic framing is:

**Make commands, artifacts, provenance, and semantic objects the primary architecture, then let both humans and agents consume that same system.**

## Notes

This report was based on review of:

- 234 TS/TSX source files
- 52 files under `src/core`
- 54 tests
- architecture and roadmap documentation across `docs/`

Verification run:

```bash
npm run typecheck
```

Outcome:

- Passed
