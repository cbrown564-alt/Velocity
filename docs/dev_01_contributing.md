# Contributing to Velocity

## 1. Tech Stack & Prerequisites

*   **Runtime:** Node.js v20+
*   **Package Manager:** npm
*   **Framework:** React 18 + Vite
*   **Language:** TypeScript 5.x
*   **State Management:** Zustand
*   **Database:** DuckDB-Wasm
*   **Styling:** Vanilla CSS Variables (see `docs/design_01_system.md`)

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
├── components/       # Reusable UI components (Button, Modal)
│   ├── ui/           # Atomic elements
│   └── domain/       # Business logic components (Pantry, Crosstab)
├── core/             # The Analytical Engine
│   ├── worker/       # Web Worker entry point
│   ├── db/           # DuckDB instance management
│   └── ingestion/    # ReadStat / Arrow parsers
├── store/            # Zustand stores (useDatasetStore, useUIStore)
├── styles/           # Global CSS and tokens
│   ├── tokens.css    # Design system variables
│   └── main.css      # Reset and global styles
└── types/            # Shared TypeScript interfaces (from arch_02_data_model)
```

## 4. Development Guidelines

### CSS & Styling
*   **Strict Vanilla CSS:** We do not use Tailwind or CSS-in-JS libraries.
*   **CSS Modules:** Use `*.module.css` for component-scoped styles.
*   **Tokens:** Always use variables from `tokens.css` (e.g., `var(--color-ink)`). Do not hardcode hex values.

### State Management
*   **Zustand:** Use for global app state (Sidebar open/close, active dataset).
*   **Context:** Use for deeply nested local state if strictly necessary (e.g., within a complex Drag-and-Drop tree).

### Performance Logic
*   **Main Thread Zero:** No heavy computation on the main thread.
*   **Worker Bridge:** All data queries go through `src/core/bridge.ts` which posts messages to the worker.

## 5. Testing

*   **Unit Tests:** Vitest
*   **End-to-End:** Playwright (Future)

```bash
npm run test
```

## 6. Code Style

*   **Linting:** ESLint + Prettier (Standard config).
*   **Naming:**
    *   React Components: `PascalCase` (e.g., `VariableCard.tsx`)
    *   Functions/Variables: `camelCase`
    *   Files: `camelCase.ts` or `PascalCase.tsx`
