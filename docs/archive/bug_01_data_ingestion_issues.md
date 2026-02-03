# Bug Report: Data Ingestion Architecture Issues

**Status:** ✅ Resolved (Proper Fix Applied)  
**Priority:** Critical  
**Discovered:** 2026-01-19  
**Fixed:** 2026-01-19  
**Milestone:** 1.7

> [!IMPORTANT]
> **2026-01-19 Update:** The initial SQL fallback workaround was replaced with a proper fix. Root cause was `apache-arrow@18.0.0` incompatible with `@duckdb/duckdb-wasm@1.29.0`. Fixed by downgrading to `apache-arrow@17.0.0`. Arrow insertion now works correctly at ~38ms.

## Summary

When testing with real SPSS `.sav` files (`test_data/sleep.sav`), multiple interconnected issues were discovered that prevent proper data display and interaction. The core problem is an **architectural split between two DuckDB instances** that causes data to be unavailable to certain UI components.

---

## Symptoms

### With Mock Data (CSV)
| Feature | Status | Notes |
|---------|--------|-------|
| DataTable | ✅ Works | Shows counts (Female 48.4%, Male 51.6%) |
| Variable Sidebar | ✅ Works | Shows NOMINAL type correctly |
| Filter Modal | ❌ Broken | Shows "0 values" for all variables |
| Recode Modal | ❌ Broken | Shows no value labels |

### With Real SAV (`sleep.sav`)
| Feature | Status | Notes |
|---------|--------|-------|
| DataTable | ❌ Broken | Shows "N = 0 Respondents" |
| Variable Sidebar | ⚠️ Partial | All variables show as SCALE (should be NOMINAL for categorical) |
| Filter Modal | ✅ Works | Shows correct values (e.g., "sex • 2 values") |
| Recode Modal | ❌ Broken | Shows no value labels |

---

## Root Causes

### 1. Dual DuckDB Instances (Critical)

The application has **two completely separate DuckDB instances**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Thread                              │
│  ┌─────────────────────┐                                    │
│  │   duckDb.ts         │ ← RecodeModal.tsx queries here     │
│  │   (dbService)       │   (EMPTY - no data loaded!)        │
│  │   Singleton         │                                    │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Web Worker                               │
│  ┌─────────────────────┐                                    │
│  │ analysisWorker.ts   │ ← Store loads data here            │
│  │   (Worker DuckDB)   │   (HAS ALL DATA!)                  │
│  │   Isolated          │                                    │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

**Impact:** When `RecodeModal` calls `dbService.getUniqueValues()`, it queries the empty main-thread DuckDB, returning no results.

**Files Involved:**
- `src/services/duckDb.ts` - Main thread singleton (should be deprecated)
- `src/services/analysisWorker.ts` - Worker with actual data
- `src/components/overlays/RecodeModal.tsx` - Uses wrong DuckDB

### 2. Simplistic Variable Type Detection

In `analysisWorker.ts` line 91:

```typescript
const type = v.type === 'numeric' ? 'scale' : 'nominal';
```

This is too simplistic. SPSS files encode categorical variables as numeric with value labels. A variable with value labels should be `nominal` or `ordinal`, not `scale`.

**Expected Logic:**
```typescript
// If has value labels → categorical (nominal)
// If numeric without labels → scale
const type = v.valueLabelSetName && parsed.metadata.valueLabelSets[v.valueLabelSetName]?.length > 0
  ? 'nominal'
  : (v.type === 'numeric' ? 'scale' : 'nominal');
```

### 3. FilterModal Uses Different Data Source

`FilterModal.tsx` uses `variable.valueLabels` from the store metadata (line 215):
```typescript
{selectedVariable?.valueLabels.map(vl => ...)}
```

This works for SAV files (metadata includes value labels) but fails for CSV files (no embedded metadata).

---

## Proposed Solution

### Phase 1: Unify Data Access

1. **Add `getUniqueValues` action to the store** that routes through the worker
2. **Update `RecodeModal`** to use the store action instead of `dbService`
3. **Deprecate `duckDb.ts`** - All queries should go through the worker

### Phase 2: Fix Variable Type Detection

1. Update `analysisWorker.ts` to check for value labels when determining variable type
2. Consider adding a `measureLevel` field if SPSS provides it in metadata

### Phase 3: Consistent Value Retrieval

1. Both `FilterModal` and `RecodeModal` should:
   - First try `variable.valueLabels` (embedded metadata)
   - Fallback to querying DuckDB for unique values

---

## Files to Modify

| File | Change |
|------|--------|
| `src/store/index.ts` | Add `getUniqueValues` action |
| `src/services/analysisWorker.ts` | Fix type detection logic |
| `src/components/overlays/RecodeModal.tsx` | Use store instead of dbService |
| `src/services/duckDb.ts` | Deprecate or remove |

---

## Test Cases

After fix, verify:

1. [ ] Load `test_data/sleep.sav`
2. [ ] Variables with value labels show as NOMINAL in sidebar
3. [ ] DataTable shows correct counts (not 0)
4. [ ] Filter Modal shows value labels and counts
5. [x] Recode Modal shows value labels
6. [ ] Same tests pass for mock CSV data

---

## Resolution

The following fixes were implemented on 2026-01-19:

### 1. Unified Data Access Layer
- Added `getUniqueValues` and `recodeVariable` actions to the Zustand store
- Updated `RecodeModal.tsx` to use store actions instead of direct `dbService` calls
- Deprecated `duckDb.ts` main-thread singleton (added deprecation notice)
- Added guard to prevent multiple worker initializations in React Strict Mode

### 2. Fixed Variable Type Detection
- Updated `analysisWorker.ts` to check for value labels when determining variable type
- Variables with value label sets are now correctly marked as `nominal` instead of `scale`

### 3. Fixed Arrow Table Insertion
- Discovered that `insertArrowTable` was silently failing in DuckDB-WASM
- Implemented SQL-based fallback: creates table schema and inserts rows in batches
- Added verification step to confirm table creation was successful

### Key Files Modified
| File | Change |
|------|--------|
| `src/store/index.ts` | Added `getUniqueValues`, `recodeVariable` actions, worker init guard |
| `src/services/analysisWorker.ts` | Fixed type detection, added fallback table creation |
| `src/components/overlays/RecodeModal.tsx` | Now uses store actions |
| `src/services/duckDb.ts` | Deprecated with notice |

---

## Screenshots

The following screenshots demonstrate the issues:

1. **Mock data - Table works, Filter shows 0 values**
2. **Mock data - Recode shows no values**
3. **Sleep.sav - Filter works, but all vars marked SCALE**
4. **Sleep.sav - Table shows 0, Recode shows no values**

(Screenshots available in session artifacts)
