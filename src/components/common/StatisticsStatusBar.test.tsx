import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatisticsStatusBar } from './StatisticsStatusBar';
import type { Variable } from '../../types';

const colVariable = { id: 'region', label: 'Region', type: 'nominal' } as Variable;

const baseSettings = {
  comparisonMethod: 'cell_vs_rest' as const,
  correctionType: 'none' as const,
  showConfidenceIntervals: false,
};

describe('StatisticsStatusBar chi-square styling (UXP-034)', () => {
  it('uses significant styling when p < 0.05', () => {
    render(
      <StatisticsStatusBar
        analysisSettings={baseSettings}
        tableStats={{
          chiSquare: { chiSquare: 12.4, df: 4, pValue: 0.012, cramersV: 0.22 },
        }}
        colVariable={colVariable}
        overlapCorrected={false}
      />
    );
    const badge = screen.getByText(/χ² = 12\.4/);
    expect(badge.className).toMatch(/chiSquareSignificant/);
    expect(badge.className).not.toMatch(/chiSquareInsignificant/);
  });

  it('uses demoted styling when p ≥ 0.05', () => {
    render(
      <StatisticsStatusBar
        analysisSettings={baseSettings}
        tableStats={{
          chiSquare: { chiSquare: 5.8, df: 4, pValue: 0.212, cramersV: 0.15 },
        }}
        colVariable={colVariable}
        overlapCorrected={false}
      />
    );
    const badge = screen.getByText(/χ² = 5\.8/);
    expect(badge.className).toMatch(/chiSquareInsignificant/);
    expect(badge.className).not.toMatch(/chiSquareSignificant/);
    expect(badge).toHaveTextContent('Independent');
  });
});
