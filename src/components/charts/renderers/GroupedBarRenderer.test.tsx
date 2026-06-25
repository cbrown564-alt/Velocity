import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupedBarRenderer } from './GroupedBarRenderer';
import type { ProcessedAnalysisData } from '../../../types/processedData';

function makeProcessedData(): ProcessedAnalysisData {
  return {
    rows: [
      {
        key: 'male',
        label: 'Male',
        rawValue: 'male',
        depth: 0,
        cells: {
          international: { count: 45, percent: 45 },
          south: { count: 55, percent: 55 },
        },
        total: 100,
        children: [],
        rowPath: [{ variable: 'gender', value: 'male' }],
      },
    ],
    series: [],
    columns: [
      { key: 'international', label: 'International', total: 100 },
      { key: 'south', label: 'South', total: 100 },
    ],
    grandTotal: 100,
    isMetric: false,
    isGrid: false,
    rowVariables: [],
    colVariable: null,
    isMultipleResponse: false,
  };
}

describe('GroupedBarRenderer legend labels', () => {
  it('renders full legend labels without truncation', () => {
    render(
      <GroupedBarRenderer
        width={800}
        height={400}
        processedData={makeProcessedData()}
      />
    );

    expect(screen.getAllByText('International').length).toBeGreaterThan(0);
    expect(screen.queryByText('Internatio...')).not.toBeInTheDocument();
  });
});
