/**
 * Diff-scoped mutation planning for CI.
 *
 * Full Stryker campaigns on every `src/core/**` touch (~50 files / ~7k mutants)
 * are too expensive for narrow PRs. Plan:
 * - skip: no mutate-eligible production files and no mutation-config change
 * - scoped: mutate only changed eligible files (cap before falling back to full)
 * - full: stryker/vitest mutation config change, explicit MUTATION_FULL, or too many files changed
 *
 * Zero npm dependencies: the CI plan step runs before `npm ci`.
 */
import fs from 'node:fs';
import path from 'node:path';

export const MUTATION_CONFIG_PATHS = Object.freeze(['stryker.config.json', 'vitest.mutation.config.ts']);

/** Above this many mutate-eligible files, prefer a full gated campaign. */
export const SCOPED_FILE_LIMIT = 8;

/**
 * @param {string} root
 * @returns {{ mutate: string[], thresholds?: Record<string, number> }}
 */
export function loadStrykerConfig(root = process.cwd()) {
  const raw = fs.readFileSync(path.join(root, 'stryker.config.json'), 'utf8');
  return JSON.parse(raw);
}

/**
 * Match Stryker mutate exclude patterns without picomatch (plan runs pre-install).
 * Supports exact paths and `prefix/**` directory trees.
 * @param {string} file
 * @param {string} pattern
 */
export function matchExcludePattern(file, pattern) {
  const f = file.replace(/\\/g, '/');
  const p = pattern.replace(/\\/g, '/');
  if (p.endsWith('/**')) {
    const prefix = p.slice(0, -3);
    return f === prefix || f.startsWith(`${prefix}/`);
  }
  if (p.includes('**/')) {
    // e.g. src/core/**/index.ts or src/core/**/__tests__/**
    if (p.endsWith('/**/__tests__/**') || p.includes('/__tests__/')) {
      return f.includes('/__tests__/');
    }
    if (p.endsWith('/**/index.ts') || p.endsWith('/index.ts')) {
      return /(^|\/)index\.ts$/.test(f);
    }
    const parts = p.split('**/');
    if (parts.length === 2 && parts[0] && parts[1] && !parts[1].includes('*')) {
      return f.startsWith(parts[0]) && f.endsWith(parts[1]) && f.length > parts[0].length + parts[1].length;
    }
  }
  return f === p;
}

/**
 * @param {readonly string[]} mutateGlobs from stryker.config.json
 * @returns {{ isMatch: (file: string) => boolean }}
 */
export function createMutateMatcher(mutateGlobs) {
  const excludes = mutateGlobs.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1));
  const includesCoreTs = mutateGlobs.some(
    (glob) => !glob.startsWith('!') && glob.includes('src/core/') && glob.endsWith('.ts'),
  );

  return {
    isMatch(file) {
      const normalized = file.replace(/\\/g, '/');
      if (!includesCoreTs) return false;
      if (!normalized.startsWith('src/core/')) return false;
      if (!normalized.endsWith('.ts')) return false;
      // Mirrors src/core/**/!(*.test|*.spec).ts
      if (normalized.endsWith('.test.ts') || normalized.endsWith('.spec.ts')) return false;
      if (normalized.includes('/__tests__/')) return false;
      if (/(^|\/)index\.ts$/.test(normalized)) return false;
      return !excludes.some((pattern) => matchExcludePattern(normalized, pattern));
    },
  };
}

/**
 * @typedef {'skip' | 'scoped' | 'full'} MutationMode
 *
 * @typedef {{
 *   mode: MutationMode;
 *   run: boolean;
 *   reason: string;
 *   mutateFiles: string[];
 *   forceFull: boolean;
 * }} MutationPlan
 */

/**
 * @param {{
 *   changedFiles: readonly string[];
 *   mutateGlobs: readonly string[];
 *   forceFull?: boolean;
 *   scopedFileLimit?: number;
 *   configPaths?: readonly string[];
 * }} input
 * @returns {MutationPlan}
 */
export function resolveMutationPlan({
  changedFiles,
  mutateGlobs,
  forceFull = false,
  scopedFileLimit = SCOPED_FILE_LIMIT,
  configPaths = MUTATION_CONFIG_PATHS,
}) {
  const normalized = changedFiles.map((f) => f.replace(/\\/g, '/')).filter(Boolean);
  const configHit = normalized.filter((f) => configPaths.includes(f));
  const matcher = createMutateMatcher(mutateGlobs);
  const mutateFiles = [...new Set(normalized.filter((f) => matcher.isMatch(f)))].sort();

  if (forceFull) {
    return {
      mode: 'full',
      run: true,
      reason: 'MUTATION_FULL requested',
      mutateFiles,
      forceFull: true,
    };
  }

  if (configHit.length > 0) {
    return {
      mode: 'full',
      run: true,
      reason: `mutation config changed (${configHit.join(', ')})`,
      mutateFiles,
      forceFull: false,
    };
  }

  if (mutateFiles.length === 0) {
    return {
      mode: 'skip',
      run: false,
      reason: 'no mutate-eligible src/core production files changed',
      mutateFiles,
      forceFull: false,
    };
  }

  if (mutateFiles.length > scopedFileLimit) {
    return {
      mode: 'full',
      run: true,
      reason: `${mutateFiles.length} mutate-eligible files exceed scoped limit ${scopedFileLimit}`,
      mutateFiles,
      forceFull: false,
    };
  }

  return {
    mode: 'scoped',
    run: true,
    reason: `scoped to ${mutateFiles.length} changed file(s)`,
    mutateFiles,
    forceFull: false,
  };
}

/**
 * Build Stryker CLI args for a plan (excluding `run` itself).
 * @param {MutationPlan} plan
 * @param {{ concurrency?: number }} [opts]
 * @returns {string[]}
 */
export function strykerArgsForPlan(plan, opts = {}) {
  const concurrency = opts.concurrency ?? 2;
  const args = ['run', '--concurrency', String(concurrency)];
  if (plan.mode === 'scoped' && plan.mutateFiles.length > 0) {
    args.push('--mutate', plan.mutateFiles.join(','));
  }
  return args;
}
