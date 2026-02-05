#!/usr/bin/env bash
set -euo pipefail

# Upgrades DuckDB-WASM to a version that supports OPFS-backed database persistence.
# Usage:
#   ./scripts/upgrade-duckdb-wasm.sh [version]
#
# Default version aligns with docs/arch_06_local_first_persistence.md.

VERSION="${1:-1.33.1-dev18.0}"

echo "Upgrading @duckdb/duckdb-wasm to ${VERSION}..."
npm pkg set "dependencies.@duckdb/duckdb-wasm=${VERSION}"

echo "Installing dependencies..."
npm install --no-audit --no-fund

echo "Installed DuckDB-WASM version:"
node -p "require('./node_modules/@duckdb/duckdb-wasm/package.json').version"
