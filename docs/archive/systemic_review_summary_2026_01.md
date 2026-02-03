# Systemic Review Summary & Implementation Roadmap (January 2026)

## 1. Executive Summary
Following a comprehensive review across four major domains (Statistical Engine, Shared Components, Variable Manager, and Dashboard), four systemic patterns have been identified that hinder the scalability, maintainability, and market trust of Velocity. This document consolidates these findings into a unified roadmap.

### Source Documentation
- [Statistical Engine Review](file:///Users/cobro/Code/Velocity/docs/review_statistical_engine_2026_01.md)
- [Component Review](file:///Users/cobro/Code/Velocity/docs/component_review_2026_01_26.md)
- [Variable Manager Review](file:///Users/cobro/Code/Velocity/docs/variable_manager_review.md)
- [Dashboard Review](file:///Users/cobro/Code/Velocity/docs/dashboard_components_review.md)

---

## 2. Common Systemic Threads

### I. Logic Leakage ("God Components")
Business logic is frequently implemented within the UI layer, leading to performance bottlenecks and untestable code.
- **Reference**: `DataTable.tsx` aggregation ([Dashboard Review §1](file:///Users/cobro/Code/Velocity/docs/dashboard_components_review.md#L8-L17)), `AnalysisChart.tsx` transformations ([Component Review §2.2](file:///Users/cobro/Code/Velocity/docs/component_review_2026_01_26.md#L25-L36)).
- **Action**: Migrate heavy transformations to `analysisWorker.ts` or memoized hooks.

### II. Styling Fragmentation
A lack of standardized styling makes the app's "Mission Control" aesthetic brittle and impossible to theme globally.
- **Reference**: Mix of Tailwind, Modules, and Inline Styles ([Component Review §2.1](file:///Users/cobro/Code/Velocity/docs/component_review_2026_01_26.md#L13-L23), [Variable Manager §2](file:///Users/cobro/Code/Velocity/docs/variable_manager_review.md#L18-L23)).
- **Action**: Converge on Semantic Tailwind tokens; purge hardcoded hex values.

### III. Over-Engineering vs. MVP Pragmatism
Technical debt is accumulating in core features while roadmap focus drifts toward complex "Phase 2" features.
- **Reference**: TSL/Pairwise features vs. Weighted Stats Bug ([Stats Review §2](file:///Users/cobro/Code/Velocity/docs/review_statistical_engine_2026_01.md#L82-L167)).
- **Action**: Prune the statistical roadmap; prioritize fundamental correctness (Weighted Means).

### IV. The Trust Barrier (Missing Verification)
Critical "Intelligence" features lack the validation required for professional market adoption.
- **Reference**: Lack of SPSS parity tests ([Stats Review §5](file:///Users/cobro/Code/Velocity/docs/review_statistical_engine_2026_01.md#L305-L326)), untested aggregation logic ([Dashboard Review §Cross-Cutting Issues](file:///Users/cobro/Code/Velocity/docs/dashboard_components_review.md#L50-L54)).
- **Action**: Implement decimal-for-decimal SPSS validation and unit tests for table aggregation.

---

## 3. Unified Implementation Plan

### Phase 1: Correctness & Stability (Immediate)
*Focus: Eliminating bugs and the most egregious design system violations.*
- [ ] **Fix Weighted Statistics**: Address the unweighted mean/stddev bug in `queryBuilder.ts`.
- [ ] **CSS Audit**: Replace hardcoded hex values in `DataTable.tsx` and `ContextMenu.tsx` with semantic variables.
- [ ] **Dead Code Cleanup**: Remove `SortableVariableCard.tsx`.

### Phase 2: Structural Refactoring (Short-Term)
*Focus: Decoupling logic from the UI.*
- [ ] **Logic Extraction**: Move `buildTree` from `DataTable.tsx` to a hook or worker utility.
- [ ] **Chart Transformation**: Move `AnalysisChart` data prep logic into the worker thread.
- [ ] **Shared Components**: Centralize icon logic (`VariableTypeIcon`) and lazy loading (`useLazyStats`).

### Phase 3: Verification & Professional Grade (Medium-Term)
*Focus: Building market trust and scalability.*
- [ ] **SPSS Validation Suite**: Create tests comparing Velocity output to SPSS CSV exports.
- [ ] **Automated Testing**: Add unit tests for the extracted `useTableData` logic.
- [ ] **Standardization**: Implement a strict "Semantic Tailwind" linting rule or configuration.

---

## 4. Strategic Adjustments
- **Roadmap Pruning**: Explicitly defer Pairwise Column Comparisons and FDR to Phase 3; remove Taylor Series Linearization entirely.
- **Performance Model**: Shift toward a "Render-Ready" data model where the worker sends UI-optimized payloads, keeping the main thread free for interaction.
