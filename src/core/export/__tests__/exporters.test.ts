import { describe, it, expect } from 'vitest';
import { exportPptx } from '../pptxExporter';
import { exportXlsx } from '../xlsxExporter';
import { canExportAsChart, _mapChartType, _transformSeriesData } from '../pptxChartBuilder';
import { resolveExportBranding, resolveExportPalette } from '../resolveThemeColors';
import { ExportConfig, ExportError } from '../types';
import { ProcessedAnalysisData } from '../../../types/processedData';
import { softMachine, missionControl } from '../../../theme/themes';
import type { ChartType } from '../../../types/charts';

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
      key: 'total',
      label: 'Total',
      data: [
        { label: 'Male', rawValue: '1', value: 50, percent: 50 },
        { label: 'Female', rawValue: '2', value: 50, percent: 50 },
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

  it('throws ExportError for empty analyses', async () => {
    const emptyConfig: ExportConfig = { title: 'Empty', analyses: [] };
    await expect(exportPptx(emptyConfig)).rejects.toThrow(ExportError);
    await expect(exportPptx(emptyConfig)).rejects.toMatchObject({ code: 'EMPTY_DATA' });
  });

  it('exports chart slides as valid PPTX', async () => {
    const chartConfig: ExportConfig = {
      title: 'Chart Report',
      analyses: [
        {
          label: 'Bar Chart',
          result: mockData,
          visualizationType: 'chart',
          chartType: 'horizontal-bar',
        },
      ],
    };
    const bytes = await exportPptx(chartConfig);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes[0]).toBe(0x50);
  });

  it('falls back to table for unsupported chart types', async () => {
    const boxPlotConfig: ExportConfig = {
      title: 'Fallback Report',
      analyses: [
        {
          label: 'Box Plot',
          result: mockData,
          visualizationType: 'chart',
          chartType: 'box-plot',
        },
      ],
    };
    const bytes = await exportPptx(boxPlotConfig);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('handles mixed table and chart analyses', async () => {
    const mixedConfig: ExportConfig = {
      title: 'Mixed Report',
      analyses: [
        { label: 'Table', result: mockData, visualizationType: 'table' },
        { label: 'Chart', result: mockData, visualizationType: 'chart', chartType: 'vertical-bar' },
        { label: 'Donut', result: mockData, visualizationType: 'chart', chartType: 'donut' },
      ],
    };
    const bytes = await exportPptx(mixedConfig);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('uses branding colors when provided', async () => {
    const brandedConfig: ExportConfig = {
      title: 'Branded Report',
      analyses: [{ label: 'Analysis', result: mockData }],
      branding: {
        primaryColor: '2D4A3E',
        headerColor: 'E07860',
        fontFamily: 'Plus Jakarta Sans',
        chartColors: ['2D4A3E', 'E07860', 'E8B468'],
      },
    };
    const bytes = await exportPptx(brandedConfig);
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

  it('throws ExportError for empty analyses', async () => {
    const emptyConfig: ExportConfig = { title: 'Empty', analyses: [] };
    await expect(exportXlsx(emptyConfig)).rejects.toThrow(ExportError);
    await expect(exportXlsx(emptyConfig)).rejects.toMatchObject({ code: 'EMPTY_DATA' });
  });
});

describe('canExportAsChart', () => {
  it('returns true for supported chart types', () => {
    const supported: ChartType[] = [
      'horizontal-bar', 'vertical-bar', 'grouped-bar', 'grouped-column',
      'stacked-bar', 'diverging-bar', 'donut', 'histogram', 'lollipop', 'scatter',
    ];
    for (const type of supported) {
      expect(canExportAsChart(type)).toBe(true);
    }
  });

  it('returns false for unsupported chart types', () => {
    const unsupported: ChartType[] = ['box-plot', 'grouped-box-plot', 'violin', 'ridgeline', 'hexbin'];
    for (const type of unsupported) {
      expect(canExportAsChart(type)).toBe(false);
    }
  });

  it('returns false for undefined', () => {
    expect(canExportAsChart(undefined)).toBe(false);
  });

  it('returns false for unknown chart type values', () => {
    expect(canExportAsChart('unknown-chart' as ChartType)).toBe(false);
  });

});



describe('mapChartType', () => {
  it('throws for unknown chart types', () => {
    expect(() => _mapChartType('unknown-chart' as ChartType)).toThrow('Unsupported chart type');
  });
});

describe('transformSeriesData', () => {
  it('transforms single series for bar charts', () => {
    const result = _transformSeriesData(mockData, 'horizontal-bar');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Total');
    expect(result[0].labels).toEqual(['Male', 'Female']);
    expect(result[0].values).toEqual([50, 50]);
  });

  it('transforms donut data filtering zero values', () => {
    const dataWithZero: ProcessedAnalysisData = {
      ...mockData,
      series: [{
        key: 'total',
        label: 'Total',
        data: [
          { label: 'A', rawValue: '1', value: 30, percent: 60 },
          { label: 'B', rawValue: '2', value: 0, percent: 0 },
          { label: 'C', rawValue: '3', value: 20, percent: 40 },
        ],
      }],
    };
    const result = _transformSeriesData(dataWithZero, 'donut');
    expect(result).toHaveLength(1);
    expect(result[0].labels).toEqual(['A', 'C']);
    expect(result[0].values).toEqual([30, 20]);
  });

  it('returns empty for missing series', () => {
    const noSeries = { ...mockData, series: [] };
    const result = _transformSeriesData(noSeries, 'horizontal-bar');
    expect(result).toEqual([]);
  });

  it('handles multi-series grouped charts', () => {
    const multiSeries: ProcessedAnalysisData = {
      ...mockData,
      series: [
        {
          key: '1',
          label: 'Agree',
          data: [
            { label: 'Male', rawValue: '1', value: 30, percent: 60 },
            { label: 'Female', rawValue: '2', value: 25, percent: 50 },
          ],
        },
        {
          key: '2',
          label: 'Disagree',
          data: [
            { label: 'Male', rawValue: '1', value: 20, percent: 40 },
            { label: 'Female', rawValue: '2', value: 25, percent: 50 },
          ],
        },
      ],
    };
    const result = _transformSeriesData(multiSeries, 'grouped-bar');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Agree');
    expect(result[1].name).toBe('Disagree');
  });
});

describe('resolveExportBranding', () => {
  it('resolves Soft Machine theme correctly', () => {
    const branding = resolveExportBranding(softMachine);
    expect(branding.primaryColor).toBe('2D4A3E');
    expect(branding.headerColor).toBe('E07860');
    expect(branding.fontFamily).toBe('Plus Jakarta Sans');
    expect(branding.chartColors).toHaveLength(6);
    expect(branding.chartColors![0]).toBe('2D4A3E');
    expect(branding.chartColors![1]).toBe('E07860');
  });

  it('resolves Mission Control theme correctly', () => {
    const branding = resolveExportBranding(missionControl);
    expect(branding.primaryColor).toBe('E0E0E0');
    expect(branding.headerColor).toBe('00D4FF');
    expect(branding.fontFamily).toBe('DM Sans');
    expect(branding.chartColors).toHaveLength(6);
    expect(branding.chartColors![0]).toBe('00D4FF');
  });
});

describe('resolveExportPalette', () => {
  it('returns 6 hex colors without hash', () => {
    const palette = resolveExportPalette(softMachine);
    expect(palette).toHaveLength(6);
    palette.forEach(color => {
      expect(color).not.toContain('#');
      expect(color).toMatch(/^[0-9A-Fa-f]{6}$/);
    });
  });
});
