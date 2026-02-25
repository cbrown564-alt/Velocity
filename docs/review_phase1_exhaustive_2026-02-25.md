# Phase 1 Exhaustive Review (Reviewer Audit)

Date: 2026-02-25  
Reviewer role source: `docs/AGENTS.md`  
Scope source: `docs/archive/tracker_00_implementation_status_pre_execution_dag_3a9f2a15.md` (Phase 1 milestones 1.1 through 1.7)  
Current status claim checked: `docs/tracker_00_implementation_status.md` ("Phase 1 core ... completed")

## 1) Summary Verdict

Phase 1 is broadly implemented and operational, but **not fully closure-grade against its original acceptance language**.

- Implementation integrity is strong for worker-based architecture, ingestion paths, crosstab canvas, filtering, nested rows, and CI/test infrastructure.
- Several Phase 1 claims are now only partially true due to later evolution, missing acceptance evidence, or known heuristic weakness.
- Current tracker wording that Phase 1 foundations are complete is directionally true, but should be qualified with residual risk and validation gaps.

## 2) Evidence Collected

### Static checks and test gates executed

- `npm run typecheck:all` passed.
- `npm run check:worker-boundary` passed.
- `npm run check:querybuilder-pure` passed.
- `npm run test:run` passed.
  - Result: 48 test files passed, 1 skipped.
  - Result: 413 tests passed, 7 skipped, 3 todo.

### Concrete "checked X, found Y" observations

- Checked worker boundary and queryBuilder purity gates, found both passing in current repo scripts.
- Checked full test suite, found no failing tests but one recurring React warning from `DraggableVariable` overlay rendering.
- Checked Phase 1 dual-DB fix path, found worker/store path is active, but deprecated main-thread DB service remains present and buildable.
- Checked Phase 1 type-detection bug fix intent, found remaining known misclassification risk for sequentially coded nominal labels.

## 3) Findings (Prioritized)

### [P1] Variable type inference still misclassifies some nominal variables

Severity rationale: This directly affects Phase 1.7 bug-fix intent and can change analysis behavior (icons, defaults, stats routing).

- Evidence:
  - `inferVariableType` defaults sequential coded labels to `ordinal`: `src/services/dataHeuristics.ts:75-86`.
  - Test file documents this trade-off explicitly (Gender-like sequential labels): `src/services/dataHeuristics.test.ts:67-89`.
  - Phase 1.7 claim says labeled SAV variables should not default to scale incorrectly: `docs/archive/tracker_00_implementation_status_pre_execution_dag_3a9f2a15.md:64`.

Verdict: **Partial completion** for Milestone 1.7 "Fix Variable Type Detection."

---

### [P1] No hard evidence for original "10MB SAV in <2s" acceptance criterion

Severity rationale: This was an explicit acceptance gate in Milestone 1.1 and is currently not continuously enforced.

- Evidence:
  - Original criterion: `docs/archive/tracker_00_implementation_status_pre_execution_dag_3a9f2a15.md:14`.
  - Current benchmark script datasets are `sleep.sav` and WVS (very large), not a 10MB acceptance target: `scripts/benchmark-sav-ingestion.ts:58-61`.
  - Existing `sleep.sav` fixture is ~26KB, not 10MB class: `test_data/sleep.sav`.

Verdict: **Not evidenced / unproven against stated gate**.

---

### [P2] "sleep.sav filter + recode + table correctness" lacks real end-to-end regression test

Severity rationale: Phase 1.7 explicitly asks for this integrated workflow validation; current tests are strong but fragmented.

- Evidence:
  - Phase 1.7 explicit requirement: `docs/archive/tracker_00_implementation_status_pre_execution_dag_3a9f2a15.md:66`.
  - Store integration ingestion test uses mocked worker events and a synthetic `ArrayBuffer(100)`: `src/test/integration/savIngestion.test.ts:61-99`.
  - Parity tests do use real SAV files for stats parity, but do not cover UI recode/filter/table flow end-to-end.

Verdict: **Coverage gap** for one explicit milestone acceptance scenario.

---

### [P2] Deprecated dual-DuckDB service remains in codebase

Severity rationale: Current runtime is safe because codepath is unused, but this remains a reintroduction risk.

- Evidence:
  - Deprecated file still exports singleton service and full main-thread DB API: `src/services/duckDb.ts:1-136`.
  - Deprecation warning correctly explains original bug: `src/services/duckDb.ts:2-15`.
  - No active imports found during audit (`rg` check), so risk is latent, not active.

Verdict: **Operationally safe now, but fragile against accidental reuse**.

---

### [P3] React warning in `DraggableVariable` overlay path

Severity rationale: Low functional risk, but indicates UI cleanliness issue and avoidable console noise.

- Evidence:
  - Overlay mode switches to native `div` but still passes `layoutId` prop: `src/features/dashboard/components/DraggableVariable.tsx:45-51`.
  - Warning reproduced in tests during full suite run.

Verdict: **Minor implementation defect**.

---

### [P3] "Smart Icon detection" is functionally present but visually collapsed for nominal vs ordinal

Severity rationale: Lower impact; UX clarity issue against milestone wording.

- Evidence:
  - Nominal and ordinal both use `CheckCircle`: `src/components/common/VariableTypeIcon.tsx:39-43`.
  - Milestone wording implies distinct smart type signaling: `docs/archive/tracker_00_implementation_status_pre_execution_dag_3a9f2a15.md:20`.

Verdict: **Partial UX fidelity to milestone intent**.

---

### [P3] Typography milestone has been superseded by later theme system

Severity rationale: Not a runtime bug, but a tracker truthfulness drift.

- Evidence:
  - Phase 1 claim: Newsreader + Atkinson: `docs/archive/tracker_00_implementation_status_pre_execution_dag_3a9f2a15.md:34`.
  - Active theme typography uses Plus Jakarta/Fraunces, DM Sans, and SF families: `src/theme/themes.ts:66-70`, `src/theme/themes.ts:136-140`, `src/theme/themes.ts:223-227`.

Verdict: **Overwritten by later feature evolution; milestone no longer literally true**.

---

### [P3] Test architecture doc is stale in at least one key area

Severity rationale: Low impact to runtime, medium impact to engineering clarity/process.

- Evidence:
  - Testing doc says browser E2E is ad-hoc via browser agent: `docs/arch_03_testing.md:11-12`, `docs/arch_03_testing.md:88-89`.
  - CI now runs Playwright E2E job automatically: `.github/workflows/test.yml:59-90`.

Verdict: **Documentation-process drift**.

## 4) Milestone-by-Milestone Audit Matrix

Status key:
- `Verified`: implemented and evidenced in code/tests.
- `Partial`: implemented but with drift/risk/missing acceptance evidence.
- `Gap`: explicit acceptance item not sufficiently evidenced.

## Milestone 1.1 - Ingestion Engine

- Initialize repository (Vite/React/TS): **Verified**
  - Evidence: `package.json`, `src/main.tsx`.
- Configure `duckdb-wasm`: **Verified**
  - Evidence: `package.json`, `src/services/duckdbBundles.ts`.
- Web Worker for DuckDB: **Verified**
  - Evidence: `src/store/slices/dataSlice.ts:211-214`, `src/services/analysisWorker.ts`.
- ReadStat/Arrow ingestion: **Verified**
  - Evidence: `src/services/analysisWorker.ts:521-603`, `src/services/analysisWorker.ts:1248-1267`.
- Verify 10MB .SAV <2s: **Gap**
  - Evidence missing as an enforced test/benchmark target (see finding above).

## Milestone 1.2 - Variable List

- Zustand store backed by DuckDB/worker: **Verified**
  - Evidence: `src/store/index.ts`, `src/store/slices/dataSlice.ts`.
- Draggable variable component: **Verified**
  - Evidence: `src/features/dashboard/components/DraggableVariable.tsx`.
- Smart icon detection: **Partial**
  - Evidence: `src/services/dataHeuristics.ts`, `src/components/common/VariableTypeIcon.tsx`.
- Virtualized list for 500+ variables: **Verified**
  - Evidence: `src/features/dashboard/components/VirtualizedVariableList.tsx:1-103`, `src/App.tsx:1656-1663`.

## Milestone 1.3 - Canvas (Crosstabs)

- Drag-and-drop via `@dnd-kit`: **Verified**
  - Evidence: `src/App.tsx:1621-1626`, `src/App.tsx:1789-1810`.
- Crosstab engine / SQL generation: **Verified**
  - Evidence: `src/store/slices/analysisSlice.ts`, `src/services/analysisWorker.ts:1317-1335`, `src/services/queryBuilder.ts`.
- HTML table + significance placeholders/evolution: **Verified**
  - Evidence: `src/features/dashboard/components/DataTable.tsx:247-297`, `src/features/dashboard/components/DataTable.tsx:464-471`.
- Global filter bar UI & logic: **Verified**
  - Evidence: `src/App.tsx:1771-1776`, `src/components/common/FilterBar.tsx:20-77`, `src/store/slices/analysisSlice.ts`.

## Milestone 1.4 - Architecture & Design System

- Data model aligned with `arch_02`: **Mostly Verified**
  - Evidence: `src/types/index.ts:21-60` (dual-state primitives present).
  - Caveat: duplicated type definitions in slices increase drift risk.
- Design tokens from `design_01_system`: **Verified**
  - Evidence: `src/index.css` semantic token layer.
- Newsreader + Atkinson typography: **Partial/Overwritten**
  - Evidence: milestone claim vs active theme fonts mismatch (see findings).

## Milestone 1.5 - Legacy UI Refactor

- DataTable refactor: **Verified**
  - Evidence: `src/features/dashboard/components/DataTable.tsx`.
- DraggableVariable refactor: **Verified (minor defect)**
  - Evidence: `src/features/dashboard/components/DraggableVariable.tsx` + warning.
- DropZone refactor: **Verified**
  - Evidence: `src/components/common/DropZone.tsx` and tests.
- DataDrawer refactor (UI only): **Verified**
  - Evidence: `src/components/overlays/DataDrawer.tsx` is presentational.
- RecodeModal refactor: **Verified**
  - Evidence: store/worker actions used in `src/components/overlays/RecodeModal.tsx`.
- Nested rows support: **Verified**
  - Evidence: recursive rendering in `src/features/dashboard/components/DataTable.tsx:181-370`.

## Milestone 1.6 - Testing Infrastructure

- Vitest + RTL configured: **Verified**
  - Evidence: `vitest.config.ts`.
- GitHub Actions workflow: **Verified**
  - Evidence: `.github/workflows/test.yml`.
- `queryBuilder.ts` extracted and purity checked: **Verified**
  - Evidence: `src/services/queryBuilder.ts`, `scripts/check-querybuilder-pure.mjs`.
- Unit tests for SQL generation (>= 25 expected): **Verified**
  - Evidence: 39 tests in `src/services/queryBuilder.test.ts`.
- Component tests for DropZone + DraggableVariable (25 expected): **Partial**
  - Evidence: currently 21 combined (`9 + 12`).
- Fixtures aligned to data model: **Verified**
  - Evidence: `src/test/fixtures/variables.ts`.
- Testing architecture doc exists: **Verified but stale**
  - Evidence: `docs/arch_03_testing.md`.

## Milestone 1.7 - Data Ingestion Bug Fixes

- Dual DuckDB architecture fix: **Verified**
  - Evidence: Recode path uses worker/store actions, no active imports of deprecated service.
- Variable type detection fix (value labels): **Partial**
  - Evidence: known heuristic trade-off still present (see P1 finding).
- Unified worker/store data access, deprecate `duckDb.ts`: **Partial**
  - Evidence: deprecation done; file still exists as latent risk.
- `sleep.sav` filter/recode/table correctness verification: **Partial/Gap**
  - Evidence: no dedicated real-file E2E path proving this exact integrated flow.

## 5) Final Assessment Against Current Tracker Claim

Current tracker says completed foundations include "Phase 1 core ingestion, canvas, design system, testing baseline, and worker unification" (`docs/tracker_00_implementation_status.md:100-103`).

Assessment:

- This statement is **mostly correct at architecture level**.
- It is **not fully closure-grade** against original Phase 1 acceptance details in the archived tracker.
- The highest-risk unresolved item is still variable type classification edge-cases for labeled nominal data.

## 6) Recommended Follow-up Work (Priority Order)

1. Add strict regression tests for nominal-vs-ordinal misclassification using real-world sequential-coded categorical variables.
2. Add a reproducible benchmark acceptance test for the explicit 10MB `<2s` ingestion claim, or revise milestone wording to modern criteria.
3. Add one true integration/E2E case using `sleep.sav` covering filter + recode + table correctness in one flow.
4. Remove or quarantine `src/services/duckDb.ts` behind build-time guards to prevent accidental future import.
5. Patch `DraggableVariable` overlay prop forwarding (`layoutId`) to eliminate DOM warning noise.
6. Sync `docs/arch_03_testing.md` with current Playwright CI behavior.

