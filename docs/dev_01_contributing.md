# Contributing to Velocity

## 1. Tech Stack & Prerequisites

*   **Runtime:** Node.js v20+
*   **Package Manager:** npm
*   **Framework:** React + Vite
*   **Language:** TypeScript 5.x
*   **State Management:** Zustand
*   **Database:** DuckDB-Wasm
*   **Styling:** Hybrid Tailwind + CSS Modules, backed by semantic CSS variables (see `docs/design_01_system.md`)

## 2. Getting Started

1.  **Clone & Install:**
    ```bash
    git clone <repo>
    cd velocity
    npm install
    ```

2.  **Start Dev Server:**
    ```bash
    npm run dev
    ```
    *Note: The dev server is configured with COOP/COEP headers required for DuckDB-Wasm multi-threading.*

## 3. Project Structure

```
src/
├── components/       # Shared UI components and overlays
├── core/             # Headless business logic and analysis/export/ingestion code
├── engine/           # VelocityEngine orchestration and provenance envelope
├── features/         # Dashboard, workspace, variable manager, harmonization
├── services/         # Browser worker/proxy services and persistence adapters
├── store/            # Zustand store and modular slices
├── theme/            # Runtime theme definitions
├── types/            # Shared TypeScript interfaces
└── index.css         # Global semantic token layer
```

## 4. Development Guidelines

### CSS & Styling
*   **Tailwind is approved:** Use Tailwind for layout, spacing, typography utilities, and rapid composition.
*   **Tokenized colors only:** Tailwind color utilities must reference semantic variables, for example `bg-[var(--bg-panel)]` and `text-[var(--text-primary)]`. Do not use raw palette classes such as `bg-white`, `text-indigo-600`, or `bg-red-500`.
*   **CSS Modules:** Use `*.module.css` for complex component states, animations, grids, and selectors that would become unreadable as utility strings.
*   **Tokens:** Always use semantic variables from `src/index.css` (for example `var(--bg-panel)`, `var(--text-primary)`, `var(--border-color)`). Do not hardcode hex values or CSS fallback hexes.

### State Management
*   **Zustand slices:** Use the existing slices for global app state. Keep business logic in `src/core/` or `src/engine/` where possible.
*   **Context:** Use for narrowly scoped UI concerns such as theme or local interaction trees.

### Performance Logic
*   **Main Thread Zero:** No heavy computation on the main thread.
*   **Worker Bridge:** Browser data queries go through the worker/proxy path (`src/services/analysisWorker.ts`, `src/services/EngineProxy.ts`) rather than querying DuckDB directly on the main thread.

## 5. Testing

*   **Unit/integration tests:** Vitest
*   **Golden/parity tests:** Vitest suites under `tests/`
*   **End-to-End:** Playwright

```bash
npm run test
npm run typecheck:all
npm run build
```

## 6. Code Style

*   **Linting:** ESLint + Prettier (Standard config).
*   **Naming:**
    *   React Components: `PascalCase` (e.g., `VariableCard.tsx`)
    *   Functions/Variables: `camelCase`
    *   Files: `camelCase.ts` or `PascalCase.tsx`
