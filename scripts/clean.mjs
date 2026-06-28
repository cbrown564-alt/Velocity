#!/usr/bin/env node
/**
 * Remove generated / local-only build and test artifacts.
 *
 * Scope is deliberately conservative: it only deletes paths that are already
 * git-ignored and cheap to regenerate. It never touches tracked sources,
 * `validation/` benchmark outputs, or `packages/readstat-wasm/dist/` (which is
 * intentionally checked in).
 *
 * Usage: `npm run clean`
 */
import { rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Top-level regeneratable output directories (see .gitignore).
const DIRS = [
  'coverage',
  'dist',
  'dist-ssr',
  'reports/mutation',
  'stryker-tmp',
  'test-results',
  'playwright-report',
  '.playwright',
  'output',
  'tmp',
];

// Directories never descended into when pruning stray files.
const SKIP_DIRS = new Set(['node_modules', '.git']);

let removed = 0;

for (const rel of DIRS) {
  const abs = join(root, rel);
  if (existsSync(abs)) {
    await rm(abs, { recursive: true, force: true });
    console.log(`removed ${rel}/`);
    removed += 1;
  }
}

// Prune stray .DS_Store files left by Finder.
let dsStores = 0;
async function pruneDsStore(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await pruneDsStore(join(dir, entry.name));
    } else if (entry.name === '.DS_Store') {
      await rm(join(dir, entry.name), { force: true });
      dsStores += 1;
    }
  }
}
await pruneDsStore(root);

if (dsStores > 0) {
  console.log(`removed ${dsStores} .DS_Store file(s)`);
  removed += dsStores;
}

console.log(removed > 0 ? `\nclean: removed ${removed} item(s).` : 'clean: nothing to remove.');
