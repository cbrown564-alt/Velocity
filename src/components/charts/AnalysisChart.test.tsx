import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartScreenReaderTable } from './AnalysisChart';
import type { ProcessedAnalysisData } from '../../types/processedData';
import type { Variable } from '../../types';

function makeVariable(label: string): Variable {
  return {
    id: label.toLowerCase(),
    name: label,
    label,
    type: 'nominal',
    valueLabels: [],
    missingValues: [],
    measure: 'nominal',
  } as unknown as Variable;
}

function makeData(): ProcessedAnalysisData {
  return {
    rows: [],
    series: [
      {
        key: 'col1',
        label: 'Column A',
        data: [
          { label: 'Yes', rawValue: '1', value: 120, percent: 60 },
          { label: 'No', rawValue: '2', value: 80, percent: 40 },
        ],
      },
      {
        key: 'col2',
        label: 'Column B',
        data: [
          { label: 'Yes', rawValue: '1', value: 90, percent: 45 },
          { label: 'No', rawValue: '2', value: 110, percent: 55 },
        ],
      },
    ],
    columns: [
      { key: 'col1', label: 'Column A', total: 200 },
      { key: 'col2', label: 'Column B', total: 200 },
    ],
    grandTotal: 400,
    isMetric: false,
    isGrid: false,
    rowVariables: [makeVariable('Q1: Agreement')],
    colVariable: makeVariable('Gender'),
    isMultipleResponse: false,
  };
}

describe('ChartScreenReaderTable (STAB-UI-A accessibility)', () => {
  it('renders a visually hidden table with chart data', () => {
    const data = makeData();
    render(<ChartScreenReaderTable data={data} />);

    const table = screen.getByRole('table');
    expect(table).toHaveClass('sr-only');

    // Caption includes row and column variable labels
    expect(screen.getByText(/Data table for Q1: Agreement by Gender/)).toBeInTheDocument();

    // Column headers
    expect(screen.getByRole('columnheader', { name: 'Column A' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Column B' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();

    // Row headers
    expect(screen.getByRole('rowheader', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'No' })).toBeInTheDocument();

    // Cell values include count and percent
    expect(screen.getByText('120 (60.0%)')).toBeInTheDocument();
    expect(screen.getByText('80 (40.0%)')).toBeInTheDocument();
    expect(screen.getByText('90 (45.0%)')).toBeInTheDocument();
    expect(screen.getByText('110 (55.0%)')).toBeInTheDocument();

    // Totals column
    expect(screen.getByText('210')).toBeInTheDocument(); // 120 + 90
    expect(screen.getByText('190')).toBeInTheDocument(); // 80 + 110
  });

  it('renders single-column data without a Total column', () => {
    const data = makeData();
    data.series = [data.series[0]];
    data.columns = [data.columns[0]];
    render(<ChartScreenReaderTable data={data} />);

    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
  });
});
