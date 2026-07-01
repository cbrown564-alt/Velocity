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

## 3. Repository Layout

```
velocity/
├── README.md, AGENTS.md     # Human + agent entry points
├── index.html               # Vite app shell
├── package.json             # npm scripts and dependencies
├── vite.config.ts, vitest.config.ts, vitest.mutation.config.ts, playwright.config.ts, stryker.config.json
│
├── src/                     # Application (React UI + core + engine)
├── public/                  # Static assets
├── packages/readstat-wasm/  # WASM SAV reader (git submodule)
│
├── cli/                     # CLI entry (`velocity.ts`)
│
├── docs/                    # Product contracts, playbooks, archive
├── evals/                   # Frozen benchmark briefs, runs, repro scripts
├── tests/                   # Vitest suites (golden, parity, e2e)
├── test_data/               # Survey fixtures (large `.sav` mostly gitignored)
│   └── fixtures/            # Small committed fixtures (e.g. test_small.sav)
│
├── scripts/                 # Maintenance, benchmarks, python/
│   └── eval/                # Browser eval runners (`npm run eval:05|06`)
├── mcp-server/              # `@velocity/mcp-server` workspace package
├── validation/              # R scripts for golden fixture regeneration
└── .github/                 # CI workflows
```

### `src/` application tree

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

**Root policy:** keep only toolchain configs and entry docs at the repo root. Ad-hoc logs, debug dumps, and one-off scripts belong under `scripts/` or `test_data/fixtures/`. Eval reproduction scripts live next to their benchmark under `evals/eval-NN/scripts/`.

### npm workspaces

The root `package.json` declares workspaces for `packages/*` and `mcp-server`. Always `npm install` from the repository root. Workspace packages are linked under `node_modules/@velocity/`.

```bash
npm run mcp:dev      # MCP server (tsx)
npm run mcp:build    # MCP tool tests
npm run eval:05      # Browser eval runner (EVAL-05)
npm run eval:06      # Browser eval runner (EVAL-06)
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

Run **`npm run ci`** before every PR (mirrors the CI `test` job). When UI, workspace, persistence, shortcuts, or onboarding changed, also run **`npm run ci:e2e`**. Full gate list: `docs/playbooks/pre_pr_verification.md`.

*   **Unit/integration tests:** Vitest
*   **Golden/parity tests:** Vitest suites under `tests/`
*   **End-to-End:** Playwright

```bash
npm run ci              # lint, format, typecheck:all, guards, coverage, build
npm run ci:e2e          # Playwright (after: npx playwright install --with-deps)
npm run test:mutation:ci   # when src/core/** changed
```

See `docs/arch_08_testing.md` for the full pyramid, coverage gates, and mutation thresholds.

## 6. Code Style

*   **Linting:** ESLint flat config plus Prettier. Existing legacy findings currently report as warnings so the repo can adopt the gate without unrelated cleanup churn.
*   **Naming:**
    *   React Components: `PascalCase` (e.g., `VariableCard.tsx`)
    *   Functions/Variables: `camelCase`
    *   Files: `camelCase.ts` or `PascalCase.tsx`
