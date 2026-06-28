#!/usr/bin/env node
/**
 * Design-system token guard (STAB-DS-1 Task 5).
 *
 * Fails on new violations outside ALLOWLIST. Shrink ALLOWLIST as debt is cleared;
 * remove it when tracker §7 acceptance is met.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'src');
const INDEX_CSS = join(SRC_DIR, 'index.css');

/** @type {ReadonlySet<string>} entries: `${relativePath}|${ruleId}` */
const ALLOWLIST = new Set([
  // Example: 'src/features/example/LegacyPanel.tsx|raw-tailwind-palette',
]);

const LEGACY_RESEARCH_DESK_TOKENS = ['--color-paper', '--color-ink', '--color-terracotta', '--color-parchment'];

const RULE = {
  LEGACY_TOKEN: 'legacy-research-desk-token',
  VAR_HEX_FALLBACK: 'var-hex-fallback',
  HARDCODED_HEX_CSS: 'hardcoded-hex-css',
  RGBA_BLACK_CSS: 'rgba-black-css',
  GRAY_TOKEN: 'gray-token',
  RAW_TAILWIND: 'raw-tailwind-palette',
  ROOT_CONTRACT: 'root-token-contract',
};

const VAR_HEX_FALLBACK = /var\(--[^,)]+,\s*#[0-9a-fA-F]{3,8}\)/;
const HARDCODED_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGBA_BLACK = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/;
const GRAY_TOKEN = /--gray-|--color-charcoal/;
const RAW_TAILWIND_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|divide|from|to|via|hover:bg|hover:text|hover:border|focus:border|focus:ring|hover:stroke|hover:fill)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?(?:\/[\d.]+)?\b/;

const ROOT_TOKEN_CHECKS = [
  /--text-tertiary:\s*var\(--muted-foreground\)/,
  /--bg-hover:\s*var\(--secondary\)/,
  /--color-warning:\s*var\(--status-warning-text\)/,
  /--status-error-bg:/,
  /--status-error-text:/,
  /--status-warning-bg:/,
  /--status-warning-text:/,
  /--status-success-bg:/,
  /--status-success-text:/,
];

function rel(path) {
  return path.replace(`${ROOT}/`, '');
}

function key(path, rule) {
  return `${rel(path)}|${rule}`;
}

function walk(dir, predicate, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath, predicate, files);
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isSourceFile(path) {
  return /\.(tsx?|css|module\.css)$/.test(path) && !path.endsWith('.test.ts') && !path.endsWith('.test.tsx');
}

function isComponentCss(path) {
  return /\.(css|module\.css)$/.test(path) && path !== INDEX_CSS;
}

function pushViolation(violations, filePath, rule, detail) {
  violations.push({ file: rel(filePath), rule, detail });
}

function collectViolations() {
  const violations = [];
  const indexCss = readFileSync(INDEX_CSS, 'utf8');
  const rootMatch = indexCss.match(/:root\s*\{([\s\S]*?)\n\}/);
  const rootBlock = rootMatch?.[1] ?? '';

  for (const token of LEGACY_RESEARCH_DESK_TOKENS) {
    if (indexCss.includes(`${token}:`)) {
      pushViolation(violations, INDEX_CSS, RULE.ROOT_CONTRACT, `defines deprecated ${token}`);
    }
  }

  for (const pattern of ROOT_TOKEN_CHECKS) {
    if (!pattern.test(rootBlock)) {
      pushViolation(violations, INDEX_CSS, RULE.ROOT_CONTRACT, `missing required semantic token (${pattern})`);
    }
  }

  for (const filePath of walk(SRC_DIR, isSourceFile)) {
    const content = readFileSync(filePath, 'utf8');

    for (const token of LEGACY_RESEARCH_DESK_TOKENS) {
      if (content.includes(token)) {
        pushViolation(violations, filePath, RULE.LEGACY_TOKEN, token);
      }
    }

    if (GRAY_TOKEN.test(content)) {
      pushViolation(violations, filePath, RULE.GRAY_TOKEN, 'gray or charcoal token reference');
    }

    if (/\.(tsx|ts)$/.test(filePath) && RAW_TAILWIND_PALETTE.test(content)) {
      pushViolation(violations, filePath, RULE.RAW_TAILWIND, 'raw Tailwind palette utility');
    }

    // rgba(0,0,0,…) in TSX/TS (theme definitions excluded — they legitimately define colors)
    if (/\.(tsx|ts)$/.test(filePath) && !filePath.includes('theme/themes.ts') && RGBA_BLACK.test(content)) {
      pushViolation(violations, filePath, RULE.RGBA_BLACK_CSS, 'rgba(0,0,0,…) usage');
    }
  }

  for (const filePath of walk(SRC_DIR, isComponentCss)) {
    const content = readFileSync(filePath, 'utf8');

    if (VAR_HEX_FALLBACK.test(content)) {
      pushViolation(violations, filePath, RULE.VAR_HEX_FALLBACK, 'var(--token, #hex) fallback');
    }
    if (HARDCODED_HEX.test(content)) {
      pushViolation(violations, filePath, RULE.HARDCODED_HEX_CSS, 'hardcoded hex color');
    }
    if (RGBA_BLACK.test(content)) {
      pushViolation(violations, filePath, RULE.RGBA_BLACK_CSS, 'rgba(0,0,0,…) usage');
    }
  }

  return violations;
}

const allViolations = collectViolations();
const allowlisted = [];
const blocking = [];

for (const violation of allViolations) {
  const entry = key(join(ROOT, violation.file), violation.rule);
  if (ALLOWLIST.has(entry)) {
    allowlisted.push(violation);
  } else {
    blocking.push(violation);
  }
}

if (blocking.length > 0) {
  console.error('Design token check failed (new or unallowlisted violations):');
  for (const { file, rule, detail } of blocking) {
    console.error(`- ${file} [${rule}]: ${detail}`);
  }
  if (ALLOWLIST.size > 0) {
    console.error(`\nAllowlisted entries remaining: ${ALLOWLIST.size}`);
  }
  process.exit(1);
}

if (allowlisted.length > 0) {
  console.warn(`Design token check passed with ${allowlisted.length} allowlisted violation(s).`);
} else {
  console.log('Design token check passed.');
}

if (ALLOWLIST.size > 0) {
  console.warn(`Allowlist entries: ${ALLOWLIST.size} (shrink as violations are fixed).`);
}
