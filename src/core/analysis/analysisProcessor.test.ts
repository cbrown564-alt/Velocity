import { processAnalysisData } from './analysisProcessor';
import { AggregatedRow, Variable } from '../../types';

describe('analysisProcessor', () => {
  const mockRowVariable: Variable = {
    id: 'gender',
    name: 'Gender',
    label: 'Gender',
    type: 'nominal',
    valueLabels: [
      { value: 1, label: 'Male' },
      { value: 2, label: 'Female' },
    ],
    missingValues: {},
  };

  const mockData: AggregatedRow[] = [
    {
      rowKeys: ['1'],
      colKey: 'Total',
      count: 40,
      weightedCount: 40,
    },
    {
      rowKeys: ['2'],
      colKey: 'Total',
      count: 60,
      weightedCount: 60,
    },
  ];

  it('processes simple frequency data correctly', () => {
    const result = processAnalysisData({
      data: mockData,
      rowVariables: [mockRowVariable],
      colVariable: null,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    // Check Columns
    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].key).toBe('Total');
    expect(result.grandTotal).toBe(100);

    // Check Rows
    expect(result.rows).toHaveLength(2);
    // Verify label resolution
    const maleRow = result.rows.find((r) => r.rawValue === '1');
    const femaleRow = result.rows.find((r) => r.rawValue === '2');

    expect(maleRow).toBeDefined();
    expect(maleRow?.label).toBe('Male');
    expect(maleRow?.total).toBe(40);

    expect(femaleRow).toBeDefined();
    expect(femaleRow?.label).toBe('Female');
    expect(femaleRow?.total).toBe(60);

    // Check Series
    expect(result.series).toHaveLength(1);
    expect(result.series[0].key).toBe('Total');
    expect(result.series[0].data).toHaveLength(2);
  });

  it('handles crosstab data correctly', () => {
    const mockColVariable: Variable = {
      id: 'brand',
      name: 'Brand',
      label: 'Brand',
      type: 'nominal',
      valueLabels: [
        { value: 101, label: 'Brand A' },
        { value: 102, label: 'Brand B' },
      ],
      missingValues: {},
    };

    const crosstabData: AggregatedRow[] = [
      // Male (1) x Brand A (101)
      { rowKeys: ['1'], colKey: '101', count: 10 },
      // Male (1) x Brand B (102)
      { rowKeys: ['1'], colKey: '102', count: 30 },
      // Female (2) x Brand A (101)
      { rowKeys: ['2'], colKey: '101', count: 40 },
      // Female (2) x Brand B (102)
      { rowKeys: ['2'], colKey: '102', count: 20 },
    ];

    const result = processAnalysisData({
      data: crosstabData,
      rowVariables: [mockRowVariable],
      colVariable: mockColVariable,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    // Columns should be resolved
    expect(result.columns).toHaveLength(2);
    expect(result.columns.map((c) => c.key).sort()).toEqual(['101', '102']);

    // Rows should be created with correct cells
    const maleRow = result.rows.find((r) => r.rawValue === '1');
    expect(maleRow).toBeDefined();

    // Access cell by column key
    expect(maleRow?.cells['101']?.count).toBe(10);
    expect(maleRow?.cells['102']?.count).toBe(30);

    // Check Totals
    // Male Total = 40
    expect(maleRow?.total).toBe(40);

    // Grand Total = 10 + 30 + 40 + 20 = 100
    expect(result.grandTotal).toBe(100);
  });

  it('normalizes null column keys to a missing bucket with a display label', () => {
    const smoke: Variable = {
      id: 'smoke',
      name: 'smoke',
      label: 'do you smoke',
      type: 'categorical',
      valueLabels: [
        { value: 1, label: 'yes' },
        { value: 2, label: 'no' },
      ],
      missingValues: {},
    };

    const crosstabData: AggregatedRow[] = [
      { rowKeys: ['1'], colKey: '1', count: 15 },
      { rowKeys: ['1'], colKey: null as unknown as string, count: 1 },
      { rowKeys: ['0'], colKey: '2', count: 131 },
    ];

    const result = processAnalysisData({
      data: crosstabData,
      rowVariables: [mockRowVariable],
      colVariable: smoke,
    });

    expect(result).not.toBeNull();
    expect(result!.columns.map((col) => col.key)).toEqual(['(Missing)', '1', '2']);
    expect(result!.columns.find((col) => col.key === '(Missing)')?.label).toBe('(Missing)');
    expect(result!.columns.find((col) => col.key === '1')?.label).toBe('yes');
  });

  it('handles metric distribution data correctly', () => {
    const metricData: AggregatedRow[] = [
      {
        rowKeys: ['1'],
        colKey: 'Total',
        count: 100,
        mean: 50,
        median: 50,
        min: 0,
        max: 100,
        q1: 25,
        q3: 75,
        validCount: 100,
      },
    ];

    const result = processAnalysisData({
      data: metricData,
      rowVariables: [mockRowVariable],
      colVariable: null,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    const row = result.rows.find((r) => r.rawValue === '1');
    expect(row).toBeDefined();
    const cell = row?.cells['Total'];
    expect(cell?.mean).toBe(50);
    expect(cell?.validCount).toBe(100);
  });

  it('builds measure parent rows with nested categorical children', () => {
    const ageVariable: Variable = {
      id: 'age',
      name: 'Age (years)',
      label: 'Age (years)',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
    };
    const regionVariable: Variable = {
      id: 'region',
      name: 'Region',
      label: 'Region',
      type: 'categorical',
      valueLabels: [
        { value: 1, label: 'East' },
        { value: 2, label: 'North' },
      ],
      missingValues: {},
    };
    const genderVariable: Variable = {
      id: 'gender',
      name: 'Gender',
      label: 'Gender',
      type: 'categorical',
      valueLabels: [
        { value: 1, label: 'Male' },
        { value: 2, label: 'Female' },
      ],
      missingValues: {},
    };

    const data: AggregatedRow[] = [
      { rowKeys: ['Age (years)'], colKey: '1', count: 500, mean: 42, validCount: 500, stdDev: 15 },
      { rowKeys: ['Age (years)'], colKey: '2', count: 700, mean: 41, validCount: 700, stdDev: 16 },
      { rowKeys: ['Age (years)', '1'], colKey: '1', count: 50 },
      { rowKeys: ['Age (years)', '1'], colKey: '2', count: 60 },
      { rowKeys: ['Age (years)', '2'], colKey: '1', count: 40 },
      { rowKeys: ['Age (years)', '2'], colKey: '2', count: 55 },
    ];

    const result = processAnalysisData({
      data,
      rowVariables: [ageVariable, regionVariable],
      colVariable: genderVariable,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.rows).toHaveLength(1);
    const ageRow = result.rows[0];
    expect(ageRow.label).toBe('Age (years)');
    expect(ageRow.cells['1']?.mean).toBe(42);
    expect(ageRow.children).toHaveLength(2);

    const east = ageRow.children.find((row) => row.rawValue === '1');
    expect(east?.cells['1']?.count).toBe(50);
    expect(east?.cells['2']?.count).toBe(60);
  });
});
