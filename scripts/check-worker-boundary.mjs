#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['src/components', 'src/features', 'src/store'];
const VALID_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const FORBIDDEN_STATIC_IMPORT =
  /^\s*import(?:["'\s]*[\w*{}\n,]+from\s*)?["'](?:@duckdb\/[^"']+|duckdb(?:\/[^"']*)?)["'];?/gm;
const FORBIDDEN_DYNAMIC_IMPORT =
  /\bimport\(\s*["'](?:@duckdb\/[^"']+|duckdb(?:\/[^"']*)?)["']\s*\)/gm;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      out.push(...walk(fullPath));
      continue;
    }
    if (VALID_EXTS.has(extname(fullPath))) {
      out.push(fullPath);
    }
  }
  return out;
}

const violations = [];
for (const dir of TARGET_DIRS) {
  for (const filePath of walk(join(ROOT, dir))) {
    const content = readFileSync(filePath, 'utf8');
    FORBIDDEN_STATIC_IMPORT.lastIndex = 0;
    FORBIDDEN_DYNAMIC_IMPORT.lastIndex = 0;
    const hasStaticImport = FORBIDDEN_STATIC_IMPORT.test(content);
    const hasDynamicImport = FORBIDDEN_DYNAMIC_IMPORT.test(content);
    if (!hasStaticImport && !hasDynamicImport) {
      continue;
    }
    violations.push(filePath.replace(`${ROOT}/`, ''));
  }
}

if (violations.length > 0) {
  console.error('DuckDB import boundary violation(s) found:');
  for (const filePath of violations) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.log('DuckDB worker boundary check passed.');
