import { describe, expect, it } from 'vitest';
import {
  SCOPED_FILE_LIMIT,
  createMutateMatcher,
  loadStrykerConfig,
  resolveMutationPlan,
  strykerArgsForPlan,
} from '../../scripts/lib/mutationScope.mjs';

const mutateGlobs = loadStrykerConfig().mutate;

describe('mutationScope', () => {
  it('treats exportPreviewSummary as mutate-eligible under gated globs', () => {
    const matcher = createMutateMatcher(mutateGlobs);
    expect(matcher.isMatch('src/core/export/exportPreviewSummary.ts')).toBe(true);
    expect(matcher.isMatch('src/core/export/exportPreviewSummary.test.ts')).toBe(false);
    expect(matcher.isMatch('src/core/export/types.ts')).toBe(false);
    expect(matcher.isMatch('src/core/session/sessionStore.ts')).toBe(false);
  });

  it('skips when only tests, lockfile, or unrelated paths change', () => {
    const plan = resolveMutationPlan({
      changedFiles: [
        'src/core/export/exportPreviewSummary.test.ts',
        'package-lock.json',
        'src/features/dashboard/ExportModal.tsx',
      ],
      mutateGlobs,
    });
    expect(plan).toMatchObject({ mode: 'skip', run: false });
  });

  it('scopes to the changed mutate-eligible file', () => {
    const plan = resolveMutationPlan({
      changedFiles: [
        'src/core/export/exportPreviewSummary.ts',
        'src/core/export/exportPreviewSummary.test.ts',
        'src/features/dashboard/ExportModal.tsx',
      ],
      mutateGlobs,
    });
    expect(plan.mode).toBe('scoped');
    expect(plan.run).toBe(true);
    expect(plan.mutateFiles).toEqual(['src/core/export/exportPreviewSummary.ts']);
    expect(strykerArgsForPlan(plan)).toEqual([
      'run',
      '--concurrency',
      '2',
      '--mutate',
      'src/core/export/exportPreviewSummary.ts',
    ]);
  });

  it('forces a full campaign when mutation config changes', () => {
    const plan = resolveMutationPlan({
      changedFiles: ['stryker.config.json', 'src/core/stats/weights.ts'],
      mutateGlobs,
    });
    expect(plan).toMatchObject({ mode: 'full', run: true });
    expect(strykerArgsForPlan(plan)).toEqual(['run', '--concurrency', '2']);
  });

  it('falls back to full when too many eligible files change', () => {
    const files = Array.from({ length: SCOPED_FILE_LIMIT + 1 }, (_, i) => `src/core/stats/mod${i}.ts`);
    const plan = resolveMutationPlan({
      changedFiles: files,
      mutateGlobs: ['src/core/**/*.ts', '!src/core/**/*.test.ts'],
    });
    expect(plan.mode).toBe('full');
    expect(plan.run).toBe(true);
  });

  it('honors MUTATION_FULL via forceFull', () => {
    const plan = resolveMutationPlan({
      changedFiles: [],
      mutateGlobs,
      forceFull: true,
    });
    expect(plan).toMatchObject({ mode: 'full', run: true, forceFull: true });
  });
});
