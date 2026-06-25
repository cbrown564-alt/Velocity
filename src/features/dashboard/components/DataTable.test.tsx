import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DataTable } from './DataTable';
import { useVelocityStore } from '../../../store';
import type { Variable, AggregatedRow } from '../../../types';
import type { ProcessedAnalysisData } from '../../../types/processedData';

// Mock useProcessedAnalysisData to return controlled data
vi.mock('../../../hooks/useProcessedAnalysisData', () => ({
  useProcessedAnalysisData: vi.fn(() => null),
}));

import { useProcessedAnalysisData } from '../../../hooks/useProcessedAnalysisData';

const mockUseProcessedAnalysisData = vi.mocked(useProcessedAnalysisData);

function makeProcessedData(cells: { col: string; row: string; percent: number; sig?: ProcessedAnalysisData['rows'][0]['cells'][string]['sig'] }[]): ProcessedAnalysisData {
  const columns = Array.from(new Set(cells.map(c => c.col))).map(key => ({ key, label: key, total: 100 }));
  const rows = Array.from(new Set(cells.map(c => c.row))).map(key => ({
    key,
    label: key,
    rawValue: key,
    depth: 0,
    cells: Object.fromEntries(
      cells.filter(c => c.row === key).map(c => [c.col, { count: 10, percent: c.percent, sig: c.sig }])
    ),
    total: 50,
    children: [],
    rowPath: [{ variable: 'var1', value: key }],
  }));

  return {
    rows,
    series: [],
    columns,
    grandTotal: 100,
    isMetric: false,
    isGrid: false,
    rowVariables: [{ id: 'v1', name: 'var1', label: 'Variable 1', type: 'categorical', valueLabels: [], missingValues: {} } as Variable],
    colVariable: null,
    isMultipleResponse: false,
  };
}

describe('DataTable hook stability', () => {
  beforeEach(() => {
    mockUseProcessedAnalysisData.mockReturnValue(null);
  });

  it('renders after processed data arrives (no conditional hooks)', () => {
    const rowVar = {
      id: 'v1',
      name: 'gender',
      label: 'Gender',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    } as Variable;

    const { rerender } = render(
      <DataTable
        data={[]}
        rowVariables={[rowVar]}
        colVariable={null}
        totalCount={100}
      />
    );

    const processed = makeProcessedData([
      { col: 'c1', row: 'r1', percent: 50 },
      { col: 'c1', row: 'r2', percent: 50 },
    ]);
    mockUseProcessedAnalysisData.mockReturnValue(processed);

    rerender(
      <DataTable
        data={[]}
        rowVariables={[rowVar]}
        colVariable={null}
        totalCount={100}
      />
    );

    expect(document.querySelector('table')).toBeTruthy();
  });
});

describe('DataTable Insight Halo', () => {
  beforeEach(() => {
    mockUseProcessedAnalysisData.mockReturnValue(null);
  });

  it('applies halo-high class to cells with 95% significance', () => {
    const processed = makeProcessedData([
      { col: 'c1', row: 'r1', percent: 70, sig: 'high_95' },
      { col: 'c1', row: 'r2', percent: 30 },
    ]);
    mockUseProcessedAnalysisData.mockReturnValue(processed);

    useVelocityStore.setState({
      analysisSettings: {
        comparisonMethod: 'cell_vs_rest',
        correctionType: 'none',
        showConfidenceIntervals: false,
        significanceLevel: 0.95,
        engine: 'auto',
        enableDesignEffects: false,
      },
      transformLog: [],
    });

    const { container } = render(
      <DataTable
        data={[]}
        rowVariables={processed.rowVariables}
        colVariable={null}
        totalCount={100}
      />
    );

    const cells = container.querySelectorAll('td.data-cell');
    // First cell should have halo-high
    expect(cells[0].className).toContain('bg-[var(--halo-high)]');
    // Second cell should not have halo
    expect(cells[1].className).not.toContain('bg-[var(--halo-high)]');
    expect(cells[1].className).not.toContain('bg-[var(--halo-mid)]');
  });

  it('applies halo-mid class to cells with 80% significance', () => {
    const processed = makeProcessedData([
      { col: 'c1', row: 'r1', percent: 60, sig: 'high_80' },
      { col: 'c1', row: 'r2', percent: 40 },
    ]);
    mockUseProcessedAnalysisData.mockReturnValue(processed);

    useVelocityStore.setState({
      analysisSettings: {
        comparisonMethod: 'cell_vs_rest',
        correctionType: 'none',
        showConfidenceIntervals: false,
        significanceLevel: 0.95,
        engine: 'auto',
        enableDesignEffects: false,
      },
      transformLog: [],
    });

    const { container } = render(
      <DataTable
        data={[]}
        rowVariables={processed.rowVariables}
        colVariable={null}
        totalCount={100}
      />
    );

    const cells = container.querySelectorAll('td.data-cell');
    expect(cells[0].className).toContain('bg-[var(--halo-mid)]');
    expect(cells[1].className).not.toContain('bg-[var(--halo-mid)]');
  });

  it('uses fixed table layout with proportional column widths (UXP-002)', () => {
    const processed = makeProcessedData([
      { col: 'east', row: 'r1', percent: 50 },
      { col: 'north', row: 'r1', percent: 50 },
      { col: 'east', row: 'r2', percent: 30 },
      { col: 'north', row: 'r2', percent: 70 },
    ]);
    processed.columns = [
      { key: 'east', label: 'East', total: 80 },
      { key: 'north', label: 'North Eastern Region', total: 120 },
    ];
    processed.colVariable = {
      id: 'region',
      name: 'region',
      label: 'Region',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    } as Variable;
    mockUseProcessedAnalysisData.mockReturnValue(processed);

    useVelocityStore.setState({
      analysisSettings: {
        comparisonMethod: 'cell_vs_rest',
        correctionType: 'none',
        showConfidenceIntervals: false,
        significanceLevel: 0.95,
        engine: 'auto',
        enableDesignEffects: false,
      },
      transformLog: [],
    });

    const { container } = render(
      <DataTable
        data={[]}
        rowVariables={processed.rowVariables}
        colVariable={processed.colVariable}
        totalCount={200}
      />
    );

    const table = container.querySelector('table');
    expect(table?.className).toContain('crosstabTable');

    const headers = Array.from(container.querySelectorAll('thead th')).slice(1);
    expect(headers).toHaveLength(3);
    const eastWidth = parseFloat((headers[0] as HTMLElement).style.width);
    const northWidth = parseFloat((headers[1] as HTMLElement).style.width);
    expect(northWidth).toBeGreaterThan(eastWidth);
  });
});
