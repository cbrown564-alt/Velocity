import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatisticsStatusBar } from './StatisticsStatusBar';
import type { Variable } from '../../types';

const colVariable = { id: 'region', label: 'Region', type: 'nominal' } as Variable;

const baseSettings = {
  comparisonMethod: 'cell_vs_rest' as const,
  correctionType: 'none' as const,
  showConfidenceIntervals: false,
  showCellN: true,
  showColumnBases: true,
};

describe('StatisticsStatusBar (margin note)', () => {
  it('states the methodology in one muted line', () => {
    render(
      <StatisticsStatusBar
        analysisSettings={baseSettings}
        tableStats={{
          chiSquare: { chiSquare: 12.4, df: 4, pValue: 0.012, cramersV: 0.22 },
        }}
        colVariable={colVariable}
        overlapCorrected={false}
      />,
    );
    expect(screen.getByText(/Welch's t · cell vs rest/)).toBeInTheDocument();
    expect(screen.getByText(/χ² 12\.4, p = \.012|χ² 12\.4, p = 0\.012/)).toBeInTheDocument();
  });

  it('reports non-significant chi-square without alarm styling', () => {
    render(
      <StatisticsStatusBar
        analysisSettings={baseSettings}
        tableStats={{
          chiSquare: { chiSquare: 5.8, df: 4, pValue: 0.212, cramersV: 0.15 },
        }}
        colVariable={colVariable}
        overlapCorrected={false}
      />,
    );
    const note = screen.getByText(/χ² 5\.8/);
    expect(note.className).toMatch(/chiSquareNote/);
  });

  it('has no settings controls — configuration lives in the recipe inspector', () => {
    render(
      <StatisticsStatusBar
        analysisSettings={baseSettings}
        tableStats={{
          chiSquare: { chiSquare: 8.2, df: 4, pValue: 0.084, cramersV: 0.19 },
        }}
        colVariable={colVariable}
        overlapCorrected={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /statistical settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cell n/i })).not.toBeInTheDocument();
  });

  it('opens the methodology drawer from the methodology line', () => {
    render(
      <StatisticsStatusBar
        analysisSettings={baseSettings}
        tableStats={null}
        colVariable={colVariable}
        overlapCorrected={false}
      />,
    );
    const pill = screen.getByRole('button', { name: /Welch's t · cell vs rest/ });
    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-expanded', 'true');
  });
});
