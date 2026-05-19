# Testing Architecture

This document defines Velocity's testing infrastructure, patterns, and standards.

## 1. Overview

Velocity uses a **5-layer testing pyramid** to ensure correctness at each architectural level:

```
        ┌───────────────┐
        │   Browser     │  ← Playwright (`tests/e2e/`)
        │   (E2E)       │
        ├───────────────┤
        │  Integration  │  ← Store + Worker + DuckDB
        ├───────────────┤
        │  Component    │  ← React Testing Library
        ├───────────────┤
        │    Unit       │  ← Pure functions (queryBuilder)
        ├───────────────┤
        │   Static      │  ← TypeScript compilation
        └───────────────┘
```

## 2. Technology Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (native Vite integration) |
| **@testing-library/react** | Component testing |
| **happy-dom** | Fast DOM simulation |
| **@vitest/coverage-v8** | Coverage reporting |
| **Playwright** | Browser E2E (`tests/e2e/`) |
| **GitHub Actions** | CI/CD automation |

## 3. Test Commands

```bash
npm test              # Watch mode (development)
npm run test:run      # Single run (CI)
npm run test:coverage # With coverage report
npm run typecheck:mcp # MCP package/server TypeScript contract
npm run test:ui       # Interactive UI
npm run test:e2e      # Playwright E2E (CI e2e job)
npm run test:parity   # R parity (optional; not in default CI)
```

## 4. Directory Structure

```
src/
├── test/
│   ├── setup.ts              # Global setup, mocks
│   ├── fixtures/
│   │   └── variables.ts      # Mock Variable, Dataset objects
│   └── integration/
│       ├── savIngestion.test.ts
│       └── storeWorker.test.ts
├── services/
│   ├── queryBuilder.ts       # Extracted SQL generation
│   └── queryBuilder.test.ts
├── types/
│   └── index.test.ts
└── components/
    └── **/*.test.tsx

test_data/
└── sleep.sav                 # Real SAV fixture (26KB)
```

## 5. Testing Layers

### 5.1 Static Analysis
TypeScript compilation catches type errors at build time. No additional configuration needed.

### 5.2 Unit Tests
Test pure functions in isolation. Key targets:
- `queryBuilder.ts`: SQL generation for crosstabs, filters, weights
- Type guards and validation utilities

### 5.3 Component Tests
Test React components with `@testing-library/react`:
- Render correctness
- User interactions (click, drag)
- State changes via Zustand store

### 5.4 Integration Tests
Test multiple layers working together:
- Store ↔ Worker communication
- SAV parsing → Variable extraction
- DuckDB query execution

### 5.5 End-to-End Tests
Playwright specs under `tests/e2e/` validate product journeys in a real browser. During stabilization (`STAB-CI-1`), E2E is the primary gate for UI/workspace/persistence behavior that Vitest coverage excludes.

| Spec | Covers |
| :--- | :--- |
| `opfs.spec.ts` | OPFS persistence, session restore, Start Fresh |
| `session-export.spec.ts` | Session export round-trip |
| `agentWorkflow.test.ts` | Agent-oriented UI workflow |
| `workspace-switch.spec.ts` | Workspace: upload two datasets, switch from catalog without re-upload |

## 6. Fixture Data

### Mock Objects (`src/test/fixtures/variables.ts`)
Reusable test data matching `arch_02_data_model.md`:
- `mockNominalVariable`
- `mockOrdinalVariable`
- `mockScaleVariable`
- `mockDataset`

### Real Files (`test_data/`)
- `sleep.sav` (26KB): Small SPSS file with known structure for integration tests

## 7. Coverage Requirements

| Metric | Threshold |
|--------|-----------|
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |
| Statements | 80% |

Coverage is enforced in CI on the **included** file set. PRs failing coverage checks will not merge.

### Known blind spots (stabilization)

`vitest.config.ts` excludes large product areas (`src/features/`, `src/store/slices/`, `src/components/overlays/`, `src/services/EngineProxy.ts`, etc.). Green coverage does not imply workspace/export UI confidence — treat Playwright E2E as the product gate until exclusions are reduced post-stabilization.

## 8. CI/CD Pipeline

GitHub Actions (`.github/workflows/test.yml`) runs on every PR to `main`:

### `test` job

1. **Typecheck**: `npm run typecheck:all` (app, tests, and MCP package)
2. **Architecture guards**: `npm run check:worker-boundary`, `npm run check:querybuilder-pure`
3. **Unit/integration tests with coverage**: `npm run test:run -- --coverage` (80% thresholds on non-excluded paths)
4. **Production build**: `npm run build`

### `e2e` job

1. **Playwright**: `npm run test:e2e` (browser installed in CI)

### Architecture guards (`test` job)

- `npm run check:design-tokens` — semantic token policy ratchet (`scripts/check-design-tokens.mjs` with shrinkable allowlist)

### Planned (`STAB-CI-1`)

- No ESLint gate today (no lint script in `package.json`)
- `npm run test:parity` remains optional/local unless runtime is proven acceptable for every PR

## 9. Writing New Tests

### Naming Convention
- Unit/Component: `ComponentName.test.tsx` or `moduleName.test.ts`
- Integration: `src/test/integration/featureName.test.ts`

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';

describe('ComponentName', () => {
  it('should do expected behavior', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## 10. Scaling for Future Phases

| Phase | Testing Additions |
|-------|-------------------|
| **2.1 Variable Sets** | Unit tests for grouping logic |
| **2.2 Weighting** | Integration tests with known weighted totals |
| **2.3 PowerPoint** | Snapshot tests for slide structure |
| **3.1 WebR** | Integration tests with known R outputs |
