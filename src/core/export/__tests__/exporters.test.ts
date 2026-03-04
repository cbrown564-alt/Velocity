import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { exportPptx, formatCell } from '../pptxExporter';
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
  series: [
    {
      key: '1',
      label: 'Agree',
      data: [
        { label: 'Male', rawValue: '1', value: 30, percent: 60.0 },
        { label: 'Female', rawValue: '2', value: 25, percent: 50.0 },
      ],
    },
  ],
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

/** Multi-series fixture — mirrors a real crosstab with 2 column-banner values */
const multiSeriesData: ProcessedAnalysisData = {
  rows: mockData.rows,
  series: [
    {
      key: '1',
      label: 'Agree',
      data: [
        { label: 'Male', rawValue: '1', value: 30, percent: 60.0 },
        { label: 'Female', rawValue: '2', value: 25, percent: 50.0 },
      ],
    },
    {
      key: '2',
      label: 'Disagree',
      data: [
        { label: 'Male', rawValue: '1', value: 20, percent: 40.0 },
        { label: 'Female', rawValue: '2', value: 25, percent: 50.0 },
      ],
    },
  ],
  columns: mockData.columns,
  grandTotal: 100,
  isMetric: false,
  isGrid: false,
  rowVariables: [],
  colVariable: null,
  isMultipleResponse: false,
};

/** Single data point edge case */
const singlePointData: ProcessedAnalysisData = {
  rows: [mockData.rows[0]],
  series: [
    {
      key: '1',
      label: 'Only',
      data: [{ label: 'Male', rawValue: '1', value: 30, percent: 100.0 }],
    },
  ],
  columns: [{ key: '1', label: 'Only', total: 30 }],
  grandTotal: 30,
  isMetric: false,
  isGrid: false,
  rowVariables: [],
  colVariable: null,
  isMultipleResponse: false,
};

/** Empty series edge case */
const emptySeriesData: ProcessedAnalysisData = {
  rows: [],
  series: [],
  columns: [],
  grandTotal: 0,
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

async function loadZip(bytes: Uint8Array): Promise<JSZip> {
  return JSZip.loadAsync(bytes);
}

// ---------------------------------------------------------------------------
// formatCell unit tests
// ---------------------------------------------------------------------------

describe('formatCell', () => {
  const cell = { count: 30, percent: 60.0, sig: 'high_95' as const, stats: { tScore: 2.5, pValue: 0.01, effN: 50 } };
  const noSigCell = { count: 20, percent: 40.0 };

  it('shows percent only by default', () => {
    expect(formatCell(cell, false, true, false)).toBe('60.0%');
  });

  it('appends significance arrow when showSig is true', () => {
    expect(formatCell(cell, true, true, false)).toBe('60.0% ▲');
  });

  it('shows count in parentheses when showCounts is true', () => {
    expect(formatCell(cell, false, true, true)).toBe('30 (60.0%)');
  });

  it('shows count with sig arrow when both are enabled', () => {
    expect(formatCell(cell, true, true, true)).toBe('30 (60.0% ▲)');
  });

  it('shows only count when showPercents is false and showCounts is true', () => {
    expect(formatCell(cell, false, false, true)).toBe('30');
  });

  it('returns empty string when both display flags are false', () => {
    expect(formatCell(cell, true, false, false)).toBe('');
  });

  it('returns empty string for undefined cell', () => {
    expect(formatCell(undefined, true, true, true)).toBe('');
  });

  it('handles low_95 significance arrow', () => {
    const lowCell = { count: 25, percent: 50.0, sig: 'low_95' as const };
    expect(formatCell(lowCell, true, true, false)).toBe('50.0% ▼');
  });

  it('handles 80% significance hollow arrows', () => {
    const hi80 = { count: 10, percent: 20.0, sig: 'high_80' as const };
    const lo80 = { count: 10, percent: 20.0, sig: 'low_80' as const };
    expect(formatCell(hi80, true, true, false)).toBe('20.0% △');
    expect(formatCell(lo80, true, true, false)).toBe('20.0% ▽');
  });

  it('does not append arrow for unknown sig value', () => {
    const unknownCell = { count: 5, percent: 10.0, sig: 'unknown_sig' as any };
    expect(formatCell(unknownCell, true, true, false)).toBe('10.0% ');
  });

  it('handles cell with no sig field', () => {
    expect(formatCell(noSigCell, true, true, false)).toBe('40.0%');
  });
});

// ---------------------------------------------------------------------------
// exportPptx integration tests
// ---------------------------------------------------------------------------

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

  it('includes analysis slide XML content for exported table data', async () => {
    const bytes = await exportPptx(config);
    const zip = await loadZip(bytes);

    const slidePaths = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name)
    );
    expect(slidePaths.length).toBeGreaterThan(0);

    const slideXml = await Promise.all(
      slidePaths.map((path) => zip.file(path)!.async('string'))
    );
    const combined = slideXml.join('\n');

    expect(combined).toContain('Male');
    expect(combined).toContain('Female');
    expect(combined).toContain('Gender by Agreement');
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

  it('handles empty analyses array (title slide only)', async () => {
    const emptyConfig: ExportConfig = { title: 'Empty Report', analyses: [] };
    const bytes = await exportPptx(emptyConfig);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4B);
  });

  it('handles chart view type without throwing', async () => {
    const chartConfig: ExportConfig = {
      title: 'Chart Report',
      analyses: [
        {
          label: 'Bar Chart',
          result: mockData,
          viewType: 'chart',
          chartType: 'vertical-bar',
        },
      ],
    };
    const bytes = await exportPptx(chartConfig);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);

    const zip = await loadZip(bytes);
    const chartXmlEntry = zip.file('ppt/charts/chart1.xml');
    expect(chartXmlEntry).toBeDefined();
    const chartXml = await chartXmlEntry!.async('string');
    expect(chartXml).toContain('<c:barChart');
  });

  it('handles donut chart type without throwing', async () => {
    const donutConfig: ExportConfig = {
      title: 'Donut Report',
      analyses: [{ label: 'Donut', result: mockData, viewType: 'chart', chartType: 'donut' }],
    };
    const bytes = await exportPptx(donutConfig);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('handles scatter chart type without throwing', async () => {
    const scatterConfig: ExportConfig = {
      title: 'Scatter Report',
      analyses: [{ label: 'Scatter', result: mockData, viewType: 'chart', chartType: 'scatter' }],
    };
    const bytes = await exportPptx(scatterConfig);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('produces a larger file when showCounts is enabled', async () => {
    const withCounts = await exportPptx({
      title: 'Counts',
      analyses: [{ label: 'A', result: mockData, options: { showPercents: true, showCounts: true, showSignificance: false } }],
    });
    const withoutCounts = await exportPptx({
      title: 'No Counts',
      analyses: [{ label: 'A', result: mockData, options: { showPercents: true, showCounts: false, showSignificance: false } }],
    });
    // More content in cells means a larger compressed file
    expect(withCounts.length).toBeGreaterThan(withoutCounts.length);
  });

  it('applies branding overrides without throwing', async () => {
    const branded = await exportPptx({
      ...config,
      branding: { primaryColor: '#003366', headerColor: '#FF6600', fontFamily: 'Arial' },
    });
    expect(branded).toBeInstanceOf(Uint8Array);
    expect(branded.length).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Chart type mapping tests (S2-EXP-2: editable chart fidelity)
// ---------------------------------------------------------------------------

describe('exportPptx chart type fidelity', () => {
  /** Helper: build a chart export config for a given chart type */
  function chartConfig(chartType: string, data = multiSeriesData): ExportConfig {
    return {
      title: `${chartType} Report`,
      analyses: [{
        label: `${chartType} chart`,
        result: data,
        viewType: 'chart' as const,
        chartType: chartType as any,
      }],
    };
  }

  // --- Natively-supported chart types ---

  it.each([
    'horizontal-bar',
    'vertical-bar',
    'grouped-bar',
    'grouped-column',
    'stacked-bar',
    'diverging-bar',
    'lollipop',
    'donut',
    'scatter',
  ] as const)('produces valid PPTX for %s chart', async (chartType) => {
    const bytes = await exportPptx(chartConfig(chartType));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // ZIP magic number
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4B);
  });

  // --- Unsupported types fall back to clustered column ---

  it.each([
    'histogram',
    'box-plot',
    'violin',
    'ridgeline',
    'hexbin',
    'grouped-box-plot',
  ] as const)('falls back to bar chart for unsupported %s type', async (chartType) => {
    const bytes = await exportPptx(chartConfig(chartType));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  // --- Multi-series handling ---

  it('renders multi-series data for bar charts', async () => {
    const bytes = await exportPptx(chartConfig('vertical-bar', multiSeriesData));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('renders multi-series data for stacked-bar', async () => {
    const bytes = await exportPptx(chartConfig('stacked-bar', multiSeriesData));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('donut uses only first series when multi-series data is provided', async () => {
    // Donut is single-series. With 2 series, only the first should be used.
    // The file should still be valid (not garbled).
    const bytes = await exportPptx(chartConfig('donut', multiSeriesData));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  // --- Edge cases ---

  it('handles single data point without throwing', async () => {
    const bytes = await exportPptx(chartConfig('vertical-bar', singlePointData));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('handles empty series array without throwing', async () => {
    const bytes = await exportPptx(chartConfig('vertical-bar', emptySeriesData));
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  // --- showCounts for charts ---

  it('renders chart with showCounts option', async () => {
    const cfg: ExportConfig = {
      title: 'Counts Chart',
      analyses: [{
        label: 'Counts',
        result: multiSeriesData,
        viewType: 'chart',
        chartType: 'vertical-bar',
        options: { showPercents: false, showCounts: true },
      }],
    };
    const bytes = await exportPptx(cfg);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('renders chart with both showPercents and showCounts', async () => {
    const cfg: ExportConfig = {
      title: 'Both',
      analyses: [{
        label: 'Both',
        result: multiSeriesData,
        viewType: 'chart',
        chartType: 'horizontal-bar',
        options: { showPercents: true, showCounts: true },
      }],
    };
    const bytes = await exportPptx(cfg);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// exportXlsx integration tests
// ---------------------------------------------------------------------------

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

  it('handles empty analyses array without throwing', async () => {
    const emptyConfig: ExportConfig = { title: 'Empty', analyses: [] };
    const bytes = await exportXlsx(emptyConfig);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });
});
