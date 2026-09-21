import { describe, it, expect } from 'vitest';
import {
  buildExportRecipeSummary,
  buildSignificanceAuditSummary,
  groupIssuesBySlide,
  resolveSlidePreviewStatus,
} from './exportPreviewSummary';
import type { SlideRecipeIssue } from './slideRecipe';

describe('exportPreviewSummary', () => {
  it('builds recipe summary with row and column variables', () => {
    const summary = buildExportRecipeSummary(
      { rowVars: ['q5', 'age'], colVar: 'segment', filters: [], weightVar: null },
      [
        { id: 'q5', name: 'Q5' },
        { id: 'age', name: 'Age' },
        { id: 'segment', name: 'SEG' },
      ],
    );

    expect(summary).toBe('Q5 + Age × SEG');
  });

  it('returns null when no row variables are configured', () => {
    expect(buildExportRecipeSummary({ rowVars: [], colVar: null, filters: [], weightVar: null }, [])).toBeNull();
  });

  it('summarizes significance audit settings for export review', () => {
    const audit = buildSignificanceAuditSummary(
      {
        comparisonMethod: 'pairwise',
        correctionType: 'bonferroni',
        showConfidenceIntervals: false,
        showCellN: false,
        showColumnBases: false,
        significanceLevel: 0.95,
        engine: 'duckdb',
      },
      true,
      'wt',
    );

    expect(audit.exportMarkers).toContain('Included');
    expect(audit.methodology).toContain('pairwise');
    expect(audit.methodology).toContain('Bonferroni');
    expect(audit.weight).toBe('Weighted by wt');
  });

  it('groups review issues by slide and resolves preview status', () => {
    const issues: SlideRecipeIssue[] = [
      {
        slideId: 's1',
        slideTitle: 'Slide 1',
        code: 'no_row_vars',
        severity: 'block',
        message: 'blocked',
      },
      {
        slideId: 's2',
        slideTitle: 'Slide 2',
        code: 'unresolved_weight_var',
        severity: 'warn',
        message: 'warn',
      },
    ];

    const grouped = groupIssuesBySlide(issues);
    expect(grouped.get('s1')).toHaveLength(1);
    expect(resolveSlidePreviewStatus(grouped.get('s1') ?? [])).toBe('blocked');
    expect(resolveSlidePreviewStatus(grouped.get('s2') ?? [])).toBe('warning');
  });
});
