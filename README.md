# Velocity

> **The Anti-SPSS.** A local-first, instant statistical environment for the modern web.

Velocity is a browser-based research tool designed to replace legacy desktop software (SPSS, WinCross) with a fast, modern, and privacy-centric "Notion for Data."

## 🚀 The Vision

We are building a tool that spans three evolutionary phases:

1.  **Velocity Core:** An instant `.SAV` viewer that runs entirely in the browser (DuckDB-Wasm).
2.  **Strategic Workbench:** A commercial-grade analysis tool with weighting, nets, and editable PowerPoint export.
3.  **Project Aletheia:** An academic environment for longitudinal research, powered by WebR and Pyodide.

## 📚 Documentation

The project is heavily documented in the `docs/` folder. Start here:

### 🔹 The Plan
*   [`docs/tracker_00_implementation_status.md`](docs/tracker_00_implementation_status.md) - **Start Here.** The daily task tracker.
*   [`docs/blue_01_unified_roadmap.md`](docs/blue_01_unified_roadmap.md) - The high-level phased roadmap.
*   [`docs/blue_02_feature_matrix.md`](docs/blue_02_feature_matrix.md) - Comprehensive feature list (Keep/Reject/Delay).

### 🔹 The Tech
*   [`docs/arch_01_system_architecture.md`](docs/arch_01_system_architecture.md) - System design (React, Worker, DuckDB).
*   [`docs/arch_02_data_model.md`](docs/arch_02_data_model.md) - Core TypeScript interfaces and data storage.
*   [`docs/design_01_system.md`](docs/design_01_system.md) - "The Research Desk" design system & CSS tokens.
*   [`docs/dec_01_stats_engine_r_vs_python.md`](docs/dec_01_stats_engine_r_vs_python.md) - Decision record on the stats engine.

### 🔹 For Developers
*   [`docs/dev_01_contributing.md`](docs/dev_01_contributing.md) - Setup guide and coding standards.
*   [`docs/ref_00_glossary.md`](docs/ref_00_glossary.md) - Domain terminology.

## 🛠️ Quick Start

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

velocity is **Local-First software**. No data is ever uploaded to a server.
