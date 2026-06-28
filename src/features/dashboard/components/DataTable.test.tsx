import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { DataTable } from './DataTable';
import { useVelocityStore } from '../../../store';
import type { Variable } from '../../../types';
import type { ProcessedAnalysisData } from '../../../types/processedData';

// Mock useProcessedAnalysisData to return controlled data
vi.mock('../../../hooks/useProcessedAnalysisData', () => ({
  useProcessedAnalysisData: vi.fn(() => null),
}));

import { useProcessedAnalysisData } from '../../../hooks/useProcessedAnalysisData';

const mockUseProcessedAnalysisData = vi.mocked(useProcessedAnalysisData);

function makeProcessedData(
  cells: {
    col: string;
    row: string;
    percent: number;
    sig?: ProcessedAnalysisData['rows'][0]['cells'][string]['sig'];
  }[],
): ProcessedAnalysisData {
  const columns = Array.from(new Set(cells.map((c) => c.col))).map((key) => ({ key, label: key, total: 100 }));
  const rows = Array.from(new Set(cells.map((c) => c.row))).map((key) => ({
    key,
    label: key,
    rawValue: key,
    depth: 0,
    cells: Object.fromEntries(
      cells.filter((c) => c.row === key).map((c) => [c.col, { count: 10, percent: c.percent, sig: c.sig }]),
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
    rowVariables: [
      {
        id: 'v1',
        name: 'var1',
        label: 'Variable 1',
        type: 'categorical',
        valueLabels: [],
        missingValues: {},
      } as Variable,
    ],
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

    const { rerender } = render(<DataTable data={[]} rowVariables={[rowVar]} colVariable={null} totalCount={100} />);

    const processed = makeProcessedData([
      { col: 'c1', row: 'r1', percent: 50 },
      { col: 'c1', row: 'r2', percent: 50 },
    ]);
    mockUseProcessedAnalysisData.mockReturnValue(processed);

    rerender(<DataTable data={[]} rowVariables={[rowVar]} colVariable={null} totalCount={100} />);

    expect(document.querySelector('table')).toBeTruthy();
  });

  it('forwards cell clicks to onCellClick with row path and col key', () => {
    const rowVar = {
      id: 'v1',
      name: 'gender',
      label: 'Gender',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    } as Variable;
    const colVar = {
      id: 'v2',
      name: 'region',
      label: 'Region',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    } as Variable;

    const processed = makeProcessedData([
      { col: 'north', row: 'male', percent: 60 },
      { col: 'north', row: 'female', percent: 40 },
    ]);
    processed.colVariable = colVar;
    processed.rows[0].rowPath = [{ variable: 'v1', value: 'male' }];
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

    const onCellClick = vi.fn();
    const { container } = render(
      <DataTable data={[]} rowVariables={[rowVar]} colVariable={colVar} totalCount={100} onCellClick={onCellClick} />,
    );

    const firstDataCell = container.querySelector('tbody td.data-cell') as HTMLTableCellElement;
    fireEvent.click(firstDataCell);

    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick).toHaveBeenCalledWith([{ variable: 'v1', value: 'male' }], 'north');
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
      <DataTable data={[]} rowVariables={processed.rowVariables} colVariable={null} totalCount={100} />,
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
      <DataTable data={[]} rowVariables={processed.rowVariables} colVariable={null} totalCount={100} />,
    );

    const cells = container.querySelectorAll('td.data-cell');
    expect(cells[0].className).toContain('bg-[var(--halo-mid)]');
    expect(cells[1].className).not.toContain('bg-[var(--halo-mid)]');
  });

  it('animates cells for small result matrices but suppresses motion for large ones', () => {
    const analysisSettings = {
      comparisonMethod: 'cell_vs_rest' as const,
      correctionType: 'none' as const,
      showConfidenceIntervals: false,
      significanceLevel: 0.95 as const,
      engine: 'auto' as const,
      enableDesignEffects: false,
    };

    // Dense matrix builder so every (row, col) cell is populated.
    const dense = (rows: number, cols: number) =>
      makeProcessedData(
        Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((__, c) => ({
            col: `c${c}`,
            row: `r${r}`,
            percent: 50,
          })),
        ),
      );

    // Small table (4 cells): entry animations active.
    mockUseProcessedAnalysisData.mockReturnValue(dense(2, 2));
    useVelocityStore.setState({ analysisSettings, transformLog: [] });
    const small = render(
      <DataTable data={[]} rowVariables={dense(2, 2).rowVariables} colVariable={null} totalCount={100} />,
    );
    expect(small.container.querySelector('[data-animated="true"]')).toBeTruthy();
    small.unmount();

    // Large table (30 x 20 = 600 cells > MAX_ANIMATED_CROSSTAB_CELLS): no motion instances.
    mockUseProcessedAnalysisData.mockReturnValue(dense(30, 20));
    const large = render(
      <DataTable data={[]} rowVariables={dense(30, 20).rowVariables} colVariable={null} totalCount={100} />,
    );
    expect(large.container.querySelector('[data-animated="true"]')).toBeNull();
  });

  it('windows large tables: renders a subset of rows plus a spacer, keeping the total row', () => {
    const analysisSettings = {
      comparisonMethod: 'cell_vs_rest' as const,
      correctionType: 'none' as const,
      showConfidenceIntervals: false,
      significanceLevel: 0.95 as const,
      engine: 'auto' as const,
      enableDesignEffects: false,
    };

    // 150 rows (> VIRTUALIZE_ROW_THRESHOLD) x 1 column.
    const big = makeProcessedData(
      Array.from({ length: 150 }).map((_, r) => ({ col: 'c1', row: `r${r}`, percent: 50 })),
    );
    mockUseProcessedAnalysisData.mockReturnValue(big);
    useVelocityStore.setState({ analysisSettings, transformLog: [] });

    const { container } = render(
      <DataTable data={[]} rowVariables={big.rowVariables} colVariable={null} totalCount={100} />,
    );

    const dataRows = container.querySelectorAll('tbody tr.data-row-interactive');
    // Windowed: far fewer than 150 rows are in the DOM.
    expect(dataRows.length).toBeGreaterThan(0);
    expect(dataRows.length).toBeLessThan(60);

    // A spacer row preserves the scroll height of the off-screen rows.
    expect(container.querySelector('tbody tr[aria-hidden]')).toBeTruthy();

    // The pinned Total row is still rendered.
    expect(container.querySelector('tbody .total-row-label')?.textContent).toBe('Total');
  });

  it('does not window small tables (no spacer rows)', () => {
    const small = makeProcessedData(
      Array.from({ length: 5 }).map((_, r) => ({ col: 'c1', row: `r${r}`, percent: 50 })),
    );
    mockUseProcessedAnalysisData.mockReturnValue(small);
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
      <DataTable data={[]} rowVariables={small.rowVariables} colVariable={null} totalCount={100} />,
    );

    expect(container.querySelectorAll('tbody tr.data-row-interactive').length).toBe(5);
    expect(container.querySelector('tbody tr[aria-hidden]')).toBeNull();
  });

  it('windows wide banners: renders a subset of columns plus a spacer, keeping the row-label and total headers', () => {
    const analysisSettings = {
      comparisonMethod: 'cell_vs_rest' as const,
      correctionType: 'none' as const,
      showConfidenceIntervals: false,
      significanceLevel: 0.95 as const,
      engine: 'auto' as const,
      enableDesignEffects: false,
    };

    // 3 rows x 40 columns (> VIRTUALIZE_COL_THRESHOLD = 30): columns window,
    // rows do not (well below VIRTUALIZE_ROW_THRESHOLD).
    const colVar = {
      id: 'region',
      name: 'region',
      label: 'Region',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    } as Variable;
    const wide = makeProcessedData(
      Array.from({ length: 3 }).flatMap((_, r) =>
        Array.from({ length: 40 }).map((__, c) => ({ col: `c${c}`, row: `r${r}`, percent: 50 })),
      ),
    );
    wide.colVariable = colVar;
    mockUseProcessedAnalysisData.mockReturnValue(wide);
    useVelocityStore.setState({ analysisSettings, transformLog: [] });

    const { container } = render(
      <DataTable data={[]} rowVariables={wide.rowVariables} colVariable={colVar} totalCount={100} />,
    );

    // Windowed: far fewer than the 40 logical body columns are in the DOM.
    const colHeaders = container.querySelectorAll('thead th[data-merge-axis="column"]');
    expect(colHeaders.length).toBeGreaterThan(0);
    expect(colHeaders.length).toBeLessThan(40);

    // A spacer header preserves the scroll width of the off-screen columns.
    expect(container.querySelector('thead th[aria-hidden]')).toBeTruthy();

    // The row-label header and the trailing Total header are never windowed.
    const headerCells = container.querySelectorAll('thead th');
    expect((headerCells[0] as HTMLElement).textContent).toBeTruthy();
    expect(Array.from(headerCells).some((th) => th.textContent?.trim() === 'Total')).toBe(true);
  });

  it('does not window narrow banners (no column spacer headers)', () => {
    const colVar = {
      id: 'region',
      name: 'region',
      label: 'Region',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    } as Variable;
    const narrow = makeProcessedData(
      Array.from({ length: 2 }).flatMap((_, r) =>
        Array.from({ length: 5 }).map((__, c) => ({ col: `c${c}`, row: `r${r}`, percent: 50 })),
      ),
    );
    narrow.colVariable = colVar;
    mockUseProcessedAnalysisData.mockReturnValue(narrow);
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
      <DataTable data={[]} rowVariables={narrow.rowVariables} colVariable={colVar} totalCount={100} />,
    );

    expect(container.querySelectorAll('thead th[data-merge-axis="column"]').length).toBe(5);
    expect(container.querySelector('thead th[aria-hidden]')).toBeNull();
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
      />,
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
