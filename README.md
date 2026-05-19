# Velocity

> **The Anti-SPSS.** A local-first, instant statistical environment for the modern web.

Velocity is a browser-based research tool designed to replace legacy desktop software (SPSS, WinCross) with a fast, modern, and privacy-centric "Notion for Data."

## The Vision

Velocity is a local-first statistical workbench for serious survey analysis. The core analytical spine is in place: browser-side ingestion, DuckDB-WASM compute, crosstabs, weighting, significance testing, editable export, the Analysis Deck, workspace concepts, `VelocityEngine`, MCP tooling, and agent-eval evidence.

The current product phase is stabilization before expansion: durable workspace reopen, export quality, design-system enforcement, documentation order, and truthful quality gates.

## Documentation

Start with `docs/README.md`. It separates live product contracts from archived planning history.

### The Plan
*   [`docs/roadmap_00_strategic_guide.md`](docs/roadmap_00_strategic_guide.md) - Strategy and sequencing.
*   [`docs/tracker_00_implementation_status.md`](docs/tracker_00_implementation_status.md) - Execution board and active work.
*   [`docs/blue_02_feature_matrix.md`](docs/blue_02_feature_matrix.md) - Scope gates.

### The Tech
*   [`docs/arch_01_system_architecture.md`](docs/arch_01_system_architecture.md) - System design (React, Worker, DuckDB).
*   [`docs/arch_02_data_model.md`](docs/arch_02_data_model.md) - Core TypeScript interfaces and data storage.
*   [`docs/arch_07_agent_architecture.md`](docs/arch_07_agent_architecture.md) - Engine, MCP, session, and provenance contracts.
*   [`docs/design_01_system.md`](docs/design_01_system.md) - Dynamic theme system, semantic tokens, and Tailwind usage.

### For Developers
*   [`AGENTS.md`](AGENTS.md) - Agent operating rules, invariants, and mandatory playbooks.
*   [`docs/dev_01_contributing.md`](docs/dev_01_contributing.md) - Setup guide and coding standards.
*   [`docs/ref_00_glossary.md`](docs/ref_00_glossary.md) - Domain terminology.

## Quick Start

**Prerequisites:** Node.js v20+

```bash
# Clone
git clone https://github.com/your-org/velocity.git
cd velocity

# Install
npm install

# Dev Mode (with Cross-Origin headers for Wasm)
npm run dev
```

**Playwright (E2E tests)**  
If `npm install @playwright/test` fails due to peer dependency conflicts (React 19 + `react-window`), use:

```bash
npm install @playwright/test --legacy-peer-deps
```

To run E2E tests:

```bash
npx playwright install
npm run test:e2e
```

Note: OPFS-backed tests require a secure context (HTTPS or localhost). The OPFS persistence test will auto-skip if OPFS is not available.

velocity is **Local-First software**. No data is ever uploaded to a server.
