#!/usr/bin/env node
/**
 * E2E companion guard (STAB-CI-4).
 *
 * When UI trigger paths change (shortcuts, onboarding, banners, theme labels),
 * at least one file under tests/e2e/ must change in the same diff. Mirrors the
 * merge-base pattern used by check-eslint-ratchet.mjs.
 */
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const E2E_PREFIX = 'tests/e2e/';
const E2E_HELPERS_PREFIX = 'tests/e2e/helpers/';

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   patterns: readonly string[];
 *   e2eHints: readonly string[];
 * }} TriggerRule
 */

/** @type {readonly TriggerRule[]} */
const TRIGGER_RULES = [
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard shortcut registry',
    patterns: ['src/lib/keyboardShortcuts/**'],
    e2eHints: ['tests/e2e/opfs.spec.ts', 'tests/e2e/pilot-workflow.spec.ts'],
  },
  {
    id: 'onboarding-tour',
    label: 'Onboarding / spotlight tour',
    patterns: ['src/features/dashboard/onboarding/**'],
    e2eHints: [
      'tests/e2e/helpers/visualPolish.ts',
      'tests/e2e/crosstab-virtualization.spec.ts',
      'tests/e2e/crosstab-column-virtualization.spec.ts',
      'tests/e2e/pilot-workflow.spec.ts',
    ],
  },
  {
    id: 'workspace-status-strip',
    label: 'Workspace status strip / pilot banners',
    patterns: [
      'src/features/workspace/components/WorkspaceStatusStrip.tsx',
      'src/features/workspace/components/WorkspaceStatusStrip.module.css',
      'src/features/workspace/lib/workspaceStatusStripSession.ts',
    ],
    e2eHints: ['tests/e2e/pilot-workflow.spec.ts'],
  },
  {
    id: 'theme-switcher',
    label: 'Theme switcher labels / a11y',
    patterns: ['src/components/common/ThemeSwitcher.tsx'],
    e2eHints: ['tests/e2e/visual-polish-theme-table.spec.ts'],
  },
  {
    id: 'contextual-micro-tips',
    label: 'Contextual micro tips / chips',
    patterns: [
      'src/features/dashboard/onboarding/ContextualMicroTipChip.tsx',
      'src/features/dashboard/onboarding/contextualMicroTips.ts',
      'src/features/dashboard/hooks/useContextualMicroTips.ts',
    ],
    e2eHints: ['tests/e2e/helpers/visualPolish.ts', 'tests/e2e/pilot-workflow.spec.ts'],
  },
];

/**
 * Allowlisted trigger misses: `${triggerRuleId}|${changedTriggerFile}`.
 * Use sparingly for intentional refactors with no E2E surface change.
 *
 * @type {ReadonlySet<string>}
 */
const ALLOWLIST = new Set([
  // Example: 'keyboard-shortcuts|src/lib/keyboardShortcuts/registry.ts',
]);

function rel(path) {
  return path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path;
}

function resolveBaseRef() {
  if (process.env.E2E_COMPANION_BASE) {
    return process.env.E2E_COMPANION_BASE;
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

function getChangedFiles(baseRef) {
  try {
    const mergeBase = execSync(`git merge-base HEAD ${baseRef}`, { encoding: 'utf8' }).trim();
    const output = execSync(`git diff --name-only --diff-filter=ACMRTUXB ${mergeBase}...HEAD`, {
      encoding: 'utf8',
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexSource = `^${escaped.replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*')}$`;
  return new RegExp(regexSource);
}

function matchesAnyPattern(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}

function isE2eCompanionChange(filePath) {
  return filePath.startsWith(E2E_PREFIX);
}

function allowlistKey(ruleId, triggerFile) {
  return `${ruleId}|${triggerFile}`;
}

const baseRef = resolveBaseRef();
const changedFiles = getChangedFiles(baseRef).map(rel);

if (changedFiles.length === 0) {
  console.log('E2E companion check passed (no changed files).');
  process.exit(0);
}

const e2eChanges = changedFiles.filter(isE2eCompanionChange);
const hasE2eCompanionUpdate = e2eChanges.length > 0;

/** @type {{ rule: TriggerRule; files: string[] }[]} */
const firedTriggers = [];

for (const rule of TRIGGER_RULES) {
  const matchedFiles = changedFiles.filter(
    (filePath) => matchesAnyPattern(filePath, rule.patterns) && !filePath.startsWith(E2E_PREFIX),
  );
  if (matchedFiles.length === 0) {
    continue;
  }

  const unallowlisted = matchedFiles.filter((filePath) => !ALLOWLIST.has(allowlistKey(rule.id, filePath)));
  if (unallowlisted.length === 0) {
    continue;
  }

  firedTriggers.push({ rule, files: unallowlisted });
}

if (firedTriggers.length === 0) {
  console.log('E2E companion check passed (no UI trigger paths changed).');
  process.exit(0);
}

if (hasE2eCompanionUpdate) {
  const helperOnly = e2eChanges.length > 0 && e2eChanges.every((filePath) => filePath.startsWith(E2E_HELPERS_PREFIX));
  const detail = helperOnly
    ? `${e2eChanges.length} helper file(s) under tests/e2e/helpers/`
    : `${e2eChanges.length} file(s) under tests/e2e/`;
  console.log(`E2E companion check passed (${firedTriggers.length} trigger(s); ${detail} updated).`);
  process.exit(0);
}

console.error(`E2E companion check failed vs ${baseRef}:`);
console.error('');
console.error(
  'UI trigger paths changed without a companion update under tests/e2e/. Update Playwright specs or helpers in the same PR.',
);
console.error('');

for (const { rule, files } of firedTriggers) {
  console.error(`Trigger: ${rule.id} — ${rule.label}`);
  for (const filePath of files) {
    console.error(`  changed: ${filePath}`);
  }
  console.error('  likely E2E specs to review:');
  for (const hint of rule.e2eHints) {
    console.error(`    - ${hint}`);
  }
  console.error('');
}

console.error('Run locally: npm run ci:e2e');
console.error('See: docs/playbooks/ui_mode_change.md, docs/playbooks/pre_pr_verification.md');

if (ALLOWLIST.size > 0) {
  console.error(`\nAllowlisted trigger entries remaining: ${ALLOWLIST.size}`);
}

process.exit(1);
