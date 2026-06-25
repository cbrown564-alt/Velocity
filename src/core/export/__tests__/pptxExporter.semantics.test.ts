import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPptx } from '../pptxExporter';
import type { ExportConfig } from '../types';
import type { ProcessedAnalysisData } from '../../../types/processedData';
import { applyTemplateBindingsToPptx } from '../templateMapping';
import JSZip from 'jszip';

type TableRow = Array<{ text: string }>;

interface RecordedSlide {
  texts: Array<{ text: string }>;
  tables: Array<{ rows: TableRow[]; opts: any }>;
  charts: Array<{ type: string; data: any; opts: any }>;
  notes: string[];
}

const mockDecks: Array<{ slides: RecordedSlide[] }> = [];

vi.mock('pptxgenjs', () => {
  class MockSlide {
    record: RecordedSlide;

    constructor(record: RecordedSlide) {
      this.record = record;
    }

    addText(text: string, _opts: any) {
      this.record.texts.push({ text });
    }

    addTable(rows: TableRow[], opts: any) {
      this.record.tables.push({ rows, opts });
    }

    addChart(type: string, data: any, opts: any) {
      this.record.charts.push({ type, data, opts });
    }

    addNotes(text: string) {
      this.record.notes.push(text);
    }
  }

  class MockPptxGenJS {
    layout = '';
    slides: RecordedSlide[] = [];

    constructor() {
      mockDecks.push(this);
    }

    addSlide() {
      const slide: RecordedSlide = { texts: [], tables: [], charts: [], notes: [] };
      this.slides.push(slide);
      return new MockSlide(slide);
    }

    async write() {
      return new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    }
  }

  return {
    default: MockPptxGenJS,
  };
});

const mockData: ProcessedAnalysisData = {
  rows: [
    {
      key: 'row-1',
      label: 'Male',
      rawValue: '1',
      depth: 0,
      cells: {
        '1': { count: 30, percent: 60.0, sig: 'high_95' },
        '2': { count: 20, percent: 40.0 },
      },
      total: 50,
      children: [],
      rowPath: [{ variable: 'gender', value: '1' }],
    },
  ],
  series: [
    {
      key: 'total',
      label: 'Total',
      data: [
        { label: 'Male', rawValue: '1', value: 50, percent: 50 },
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

function lastDeck() {
  return mockDecks[mockDecks.length - 1];
}

describe('exportPptx semantics', () => {
  beforeEach(() => {
    mockDecks.length = 0;
  });

  it('renders percent-only cells and omits total column when showCounts is false', async () => {
    const config: ExportConfig = {
      title: 'Percent Only',
      analyses: [{ label: 'A1', result: mockData, options: { showPercents: true, showCounts: false, showSignificance: true } }],
    };

    await exportPptx(config);

    const analysisSlide = lastDeck().slides[1];
    const table = analysisSlide.tables[0];
    const header = table.rows[0].map((c) => c.text);
    const dataRow = table.rows[1].map((c) => c.text);

    expect(header).toEqual(['', 'Agree', 'Disagree']);
    expect(dataRow).toEqual(['Male', '60.0% ▲', '40.0%']);
    expect(table.opts.colW).toHaveLength(3);
  });

  it('renders count-only cells and includes total column when showCounts is true', async () => {
    const config: ExportConfig = {
      title: 'Count Only',
      analyses: [{ label: 'A1', result: mockData, options: { showPercents: false, showCounts: true, showSignificance: true } }],
    };

    await exportPptx(config);

    const analysisSlide = lastDeck().slides[1];
    const table = analysisSlide.tables[0];
    const header = table.rows[0].map((c) => c.text);
    const dataRow = table.rows[1].map((c) => c.text);

    expect(header).toEqual(['', 'Agree', 'Disagree', 'Total']);
    expect(dataRow).toEqual(['Male', '30', '20', '50']);
    expect(table.opts.colW).toHaveLength(4);
  });

  it('renders combined count+percent format when both toggles are enabled', async () => {
    const config: ExportConfig = {
      title: 'Count and Percent',
      analyses: [{ label: 'A1', result: mockData, options: { showPercents: true, showCounts: true, showSignificance: true } }],
    };

    await exportPptx(config);

    const analysisSlide = lastDeck().slides[1];
    const table = analysisSlide.tables[0];
    const dataRow = table.rows[1].map((c) => c.text);

    expect(dataRow).toEqual(['Male', '30 (60.0% ▲)', '20 (40.0%)', '50']);
  });

  it('normalizes chart colors and uses a single series color for single-series bars', async () => {
    const config: ExportConfig = {
      title: 'Chart Colors',
      analyses: [
        { label: 'Chart 1', result: mockData, visualizationType: 'chart', chartType: 'horizontal-bar' },
      ],
      branding: {
        primaryColor: '#222222',
        headerColor: 'rgba(224, 122, 95, 1)',
        chartColors: ['#2D4A3E', 'rgba(224, 120, 96, 1)'],
      },
    };

    await exportPptx(config);

    const analysisSlide = lastDeck().slides[1];
    const chart = analysisSlide.charts[0];

    expect(chart.opts.chartColors).toEqual(['2D4A3E']);
    expect(chart.opts.valGridLine).toEqual(
      expect.objectContaining({ color: '222222', size: 0.5 }),
    );
    expect(chart.opts.barGapWidthPct).toBe(25);
  });

  it('renders subtitles, notes, and section divider slides when present', async () => {
    const config: ExportConfig = {
      title: 'Narrative Report',
      sections: [{ id: 'sec-1', title: 'Executive Summary' }],
      analyses: [
        {
          label: 'Gender by Agreement',
          subtitle: 'Adults 18+',
          notes: 'Lead with the gender split on slide delivery.',
          sectionId: 'sec-1',
          result: mockData,
        },
      ],
    };

    await exportPptx(config);

    const deck = lastDeck();
    expect(deck.slides).toHaveLength(3);
    expect(deck.slides[1].texts.map((entry) => entry.text)).toContain('Executive Summary');
    expect(deck.slides[2].texts.map((entry) => entry.text)).toEqual(
      expect.arrayContaining(['Gender by Agreement', 'Adults 18+'])
    );
    expect(deck.slides[2].notes).toEqual(['Lead with the gender split on slide delivery.']);
  });

  it('applies template bindings in wave refresh mode when template options are provided', async () => {
    const applyTemplateBindings = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const config: ExportConfig = {
      title: 'Template Refresh',
      analyses: [],
      templateOptions: {
        template: {
          id: 'tmpl-1',
          filename: 'client-template.pptx',
          placeholders: [{ id: 'placeholder-1', token: '{{slide.title}}', slideIndex: 1 }],
          diagnostics: [],
        },
        mapping: {
          templateId: 'tmpl-1',
          bindings: [{ placeholderId: 'placeholder-1', slot: 'slide.title' }],
        },
        slideRecipes: [
          {
            slideId: 'slide-1',
            title: 'Wave 3 Tracker',
            subtitle: 'Latest wave',
            analysisState: { rowVars: ['q1'], colVar: null, filters: [], weightVar: null },
            visualizationType: 'table',
          },
        ],
        baseTemplate: new Uint8Array([0x50, 0x4b]),
        refreshMode: 'wave_refresh',
        applyTemplateBindings,
      },
    };

    const output = await exportPptx(config);

    expect(output).toEqual(new Uint8Array([1, 2, 3]));
    expect(applyTemplateBindings).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshMode: 'wave_refresh',
        preserveUntouchedContent: true,
        bindings: [
          expect.objectContaining({
            placeholderId: 'placeholder-1',
            resolvedValue: 'Wave 3 Tracker',
          }),
        ],
      })
    );
    expect(mockDecks).toHaveLength(0);
  });

  it('fails template export when required template wiring is missing', async () => {
    await expect(
      exportPptx({
        title: 'Broken Template',
        analyses: [],
        templateOptions: {
          template: {
            id: 'tmpl-1',
            filename: 'client-template.pptx',
            placeholders: [{ id: 'placeholder-1', token: '{{slide.title}}' }],
            diagnostics: [],
          },
          mapping: {
            templateId: 'tmpl-1',
            bindings: [{ placeholderId: 'placeholder-1', slot: 'slide.title' }],
          },
          slideRecipes: [
            {
              slideId: 'slide-1',
              title: 'Slide 1',
              subtitle: '',
              analysisState: { rowVars: ['q1'], colVar: null, filters: [], weightVar: null },
              visualizationType: 'table',
            },
          ],
        },
      })
    ).rejects.toThrow(/requires a base template binary/i);
  });

  it('executes binary template path with real applyTemplateBindings handler', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', '<p:sld><a:t>{{slide.title}}</a:t></p:sld>');
    const baseTemplate = await zip.generateAsync({ type: 'uint8array' });

    const output = await exportPptx({
      title: 'Template Binary Path',
      analyses: [],
      templateOptions: {
        template: {
          id: 'tmpl-1',
          filename: 'client-template.pptx',
          placeholders: [{ id: 'placeholder-1', token: '{{slide.title}}', slideIndex: 1 }],
          diagnostics: [],
        },
        mapping: {
          templateId: 'tmpl-1',
          bindings: [{ placeholderId: 'placeholder-1', slot: 'slide.title' }],
        },
        slideRecipes: [
          {
            slideId: 'slide-1',
            title: 'Client Headline',
            subtitle: '',
            analysisState: { rowVars: ['q1'], colVar: null, filters: [], weightVar: null },
            visualizationType: 'table',
          },
        ],
        baseTemplate,
        applyTemplateBindings: applyTemplateBindingsToPptx,
      },
    });

    const resultZip = await JSZip.loadAsync(output);
    const slideXml = await resultZip.file('ppt/slides/slide1.xml')!.async('string');
    expect(slideXml).toContain('Client Headline');
    expect(slideXml).not.toContain('{{slide.title}}');
  });
});
