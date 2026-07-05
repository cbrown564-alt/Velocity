#!/usr/bin/env node
/**
 * Plan 06 Phase 4 — WP4.2 bundle audit gate.
 *
 * Asserts production chunk budgets after `vite build`:
 *   - Main index chunk < 350 KB (raw minified)
 *   - No frozen-feature chunks reappearing (WebR, harmonization, Monaco R editor, etc.)
 *   - No DuckDB MVP variant shipped (removed — pilots use eh/coi only)
 *
 * Run: node scripts/check-chunk-budgets.mjs
 * Requires: dist/ from a fresh build (CI runs `npm run build` first).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_ASSETS = path.join(ROOT, 'dist', 'assets');

const INDEX_BUDGET_BYTES = Number(process.env.CHUNK_BUDGET_INDEX_BYTES || 350 * 1024);

/** Chunks excised in Plan 06 Phase 1 — must not reappear in dist/assets. */
const FORBIDDEN_CHUNK_PATTERNS = [
  /harmonization/i,
  /webr/i,
  /RCodeEditor/i,
  /AdvancedAnalysisPanel/i,
  /MixedEffectsRunner/i,
  /SurveyWeightingRunner/i,
];

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function listAssetFiles() {
  if (!fs.existsSync(DIST_ASSETS)) {
    throw new Error('dist/assets not found — run `npm run build` first');
  }
  return fs.readdirSync(DIST_ASSETS).map((name) => ({
    name,
    bytes: fs.statSync(path.join(DIST_ASSETS, name)).size,
  }));
}

function main() {
  const assets = listAssetFiles();
  const failures = [];

  const indexChunks = assets.filter((file) => /^index-.*\.js$/.test(file.name));
  if (indexChunks.length === 0) {
    failures.push('No index-*.js chunk found in dist/assets');
  } else {
    const largestIndex = indexChunks.reduce((max, file) => (file.bytes > max.bytes ? file : max));
    if (largestIndex.bytes > INDEX_BUDGET_BYTES) {
      failures.push(
        `index chunk ${largestIndex.name} is ${formatKb(largestIndex.bytes)} (budget ${formatKb(INDEX_BUDGET_BYTES)})`,
      );
    }
  }

  for (const file of assets) {
    for (const pattern of FORBIDDEN_CHUNK_PATTERNS) {
      if (pattern.test(file.name)) {
        failures.push(`Forbidden frozen-feature chunk reappeared: ${file.name}`);
      }
    }
  }

  const mvpAssets = assets.filter((file) => /duckdb-mvp|duckdb-browser-mvp/.test(file.name));
  if (mvpAssets.length > 0) {
    failures.push(
      `DuckDB MVP variant still shipped (${mvpAssets.map((f) => f.name).join(', ')}) — pilots use eh/coi only`,
    );
  }

  const motionVendor = assets.find((file) => file.name.startsWith('motion-vendor'));
  const summary = {
    indexBudgetBytes: INDEX_BUDGET_BYTES,
    indexChunks: indexChunks.map((file) => ({ name: file.name, bytes: file.bytes })),
    motionVendorBytes: motionVendor?.bytes ?? null,
    motionVendorNote:
      'motion-vendor (framer-motion, ~127 KB raw) remains warranted for AnimatePresence/modal transitions under calm design — coordinate with DESIGN-CONV for a CSS-transition diet; no removal in this phase.',
    mvpAssetsRemoved: mvpAssets.length === 0,
    assetCount: assets.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    console.error('\nChunk budget failures:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('\nChunk budget gate: PASS');
}

main();
