import { describe, it, expect } from 'vitest';
import { exportPptx } from '../pptxExporter';
import { exportXlsx } from '../xlsxExporter';
import { ExportConfig } from '../types';
import { ProcessedAnalysisData } from '../../../types/processedData';

const mockData: ProcessedAnalysisData = {
  rows: [
    {
      key: 'row-1',
      label: 'Male',
      rawValue: '1',
      depth: 0,
      cells: {
        '1': { count: 30, percent: 60.0, sig: 'high_95', stats: { tScore: 2.5, pValue: 0.01, effN: 50 } },
        '2': { count: 20, percent: 40.0 },
      },
      total: 50,
      children: [],
      rowPath: [{ variable: 'gender', value: '1' }],
    },
    {
      key: 'row-2',
      label: 'Female',
      rawValue: '2',
      depth: 0,
      cells: {
        '1': { count: 25, percent: 50.0 },
        '2': { count: 25, percent: 50.0, sig: 'low_95' },
      },
      total: 50,
      children: [],
      rowPath: [{ variable: 'gender', value: '2' }],
    },
  ],
  series: [],
  columns: [
    { key: '1', label: 'Agree', total: 55 },
    { key: '2', label: 'Disagree', total: 45 },
  ],
  grandTotal: 100,
  isMetric: false,
  isGrid: false,
  rowVariables: [],
  colVariable: null,
  isMultipleResponse: false,
};

const config: ExportConfig = {
  title: 'Test Report',
  analyses: [
    { label: 'Gender by Agreement', result: mockData },
  ],
};

describe('exportPptx', () => {
  it('produces a valid PPTX (ZIP) file', async () => {
    const bytes = await exportPptx(config);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // ZIP magic number: PK\x03\x04
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4B); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it('handles multiple analyses', async () => {
    const multiConfig: ExportConfig = {
      title: 'Multi Report',
      analyses: [
        { label: 'Analysis 1', result: mockData },
        { label: 'Analysis 2', result: mockData },
      ],
    };
    const bytes = await exportPptx(multiConfig);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe('exportXlsx', () => {
  it('produces a valid XLSX (ZIP) file', async () => {
    const bytes = await exportXlsx(config);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // ZIP magic number
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4B);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it('handles multiple analyses as separate sheets', async () => {
    const multiConfig: ExportConfig = {
      title: 'Multi Report',
      analyses: [
        { label: 'Sheet One', result: mockData },
        { label: 'Sheet Two', result: mockData },
      ],
    };
    const bytes = await exportXlsx(multiConfig);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
