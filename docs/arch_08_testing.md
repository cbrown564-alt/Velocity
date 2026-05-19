# Testing Architecture

This document defines Velocity's testing infrastructure, patterns, and standards.

## 1. Overview

Velocity uses a **5-layer testing pyramid** to ensure correctness at each architectural level:

```
        ┌───────────────┐
        │   Browser     │  ← Ad-hoc via browser agent
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
| **GitHub Actions** | CI/CD automation |

## 3. Test Commands

```bash
npm test              # Watch mode (development)
npm run test:run      # Single run (CI)
npm run test:coverage # With coverage report
npm run test:ui       # Interactive UI
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
Browser-based testing via the browser agent for ad-hoc user journey validation.

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

Coverage is enforced in CI. PRs failing coverage checks will not merge.

## 8. CI/CD Pipeline

GitHub Actions runs on every PR:

1. **Lint**: TypeScript type check
2. **Test**: `npm run test:run`
3. **Coverage**: Fail if below 80%

See `.github/workflows/test.yml` for configuration.

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
