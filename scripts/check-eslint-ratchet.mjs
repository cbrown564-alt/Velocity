#!/usr/bin/env node
/**
 * ESLint ratchet (STAB-CI-3).
 *
 * Changed files (vs merge base) must have zero ESLint warnings/errors outside
 * ALLOWLIST. Shrink ALLOWLIST as debt is cleared; remove when empty.
 */
import { execSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const ESLINT_EXTENSIONS = /\.(mjs|cjs|js|jsx|ts|tsx)$/;

/** @type {ReadonlySet<string>} entries: `${relativePath}|${ruleId}` */
const ALLOWLIST = new Set([
  // Example: 'src/legacy/Panel.tsx|@typescript-eslint/no-unused-vars',
]);

function rel(path) {
  return path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path;
}

function key(filePath, ruleId) {
  return `${rel(filePath)}|${ruleId ?? 'unknown'}`;
}

function resolveBaseRef() {
  if (process.env.ESLINT_RATCHET_BASE) {
    return process.env.ESLINT_RATCHET_BASE;
  }
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }
  try {
    execSync('git rev-parse --verify origin/main', { stdio: 'ignore' });
    return 'origin/main';
  } catch {
    return 'main';
  }
}

function getChangedLintableFiles(baseRef) {
  try {
    const mergeBase = execSync(`git merge-base HEAD ${baseRef}`, { encoding: 'utf8' }).trim();
    const output = execSync(`git diff --name-only --diff-filter=ACMRTUXB ${mergeBase}...HEAD`, {
      encoding: 'utf8',
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && ESLINT_EXTENSIONS.test(line));
  } catch {
    return [];
  }
}

function lintFiles(files) {
  const result = spawnSync('npx', ['eslint', '--format', 'json', '--max-warnings', '0', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  let parsed = [];
  try {
    parsed = JSON.parse(result.stdout || '[]');
  } catch {
    console.error('ESLint ratchet failed to parse ESLint JSON output.');
    if (result.stderr) {
      console.error(result.stderr);
    }
    process.exit(1);
  }

  const violations = [];
  for (const fileResult of parsed) {
    for (const message of fileResult.messages) {
      if (message.severity === 0) {
        continue;
      }
      violations.push({
        file: rel(fileResult.filePath),
        ruleId: message.ruleId ?? 'unknown',
        line: message.line,
        severity: message.severity === 2 ? 'error' : 'warning',
        message: message.message,
      });
    }
  }

  if (result.status !== 0 && violations.length === 0 && result.stderr) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }

  return violations;
}

const baseRef = resolveBaseRef();
const changedFiles = getChangedLintableFiles(baseRef);

if (changedFiles.length === 0) {
  console.log('ESLint ratchet passed (no lintable changed files).');
  process.exit(0);
}

const allViolations = lintFiles(changedFiles);
const allowlisted = [];
const blocking = [];

for (const violation of allViolations) {
  const entry = key(violation.file, violation.ruleId);
  if (ALLOWLIST.has(entry)) {
    allowlisted.push(violation);
  } else {
    blocking.push(violation);
  }
}

if (blocking.length > 0) {
  console.error(`ESLint ratchet failed on ${changedFiles.length} changed file(s) vs ${baseRef}:`);
  for (const { file, ruleId, line, severity, message } of blocking) {
    console.error(`- ${file}:${line} [${ruleId}] (${severity}): ${message}`);
  }
  if (ALLOWLIST.size > 0) {
    console.error(`\nAllowlisted entries remaining: ${ALLOWLIST.size}`);
  }
  process.exit(1);
}

if (allowlisted.length > 0) {
  console.warn(`ESLint ratchet passed with ${allowlisted.length} allowlisted violation(s) on changed files.`);
} else {
  console.log(`ESLint ratchet passed (${changedFiles.length} changed file(s) clean).`);
}

if (ALLOWLIST.size > 0) {
  console.warn(`Allowlist entries: ${ALLOWLIST.size} (shrink as violations are fixed).`);
}
