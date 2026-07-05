import { describe, expect, it } from 'vitest';
import type { ProcessedAnalysisData } from '../../../types/processedData';
import {
  assertPreviewExportStructuralParity,
  buildDeckExportStructuralSnapshot,
  buildDeckPreviewModel,
  type MaterializedDeck,
} from '../index';

const processedFixture: ProcessedAnalysisData = {
  rows: [
    {
      key: 'row-1',
      label: 'Male',
      rawValue: '1',
      depth: 0,
      cells: { '1': { count: 30, percent: 60.0 } },
      total: 50,
      children: [],
      rowPath: [{ variable: 'gender', value: '1' }],
    },
  ],
  series: [{ key: '1', label: 'Agree', data: [{ label: 'Male', rawValue: '1', value: 30, percent: 60.0 }] }],
  columns: [{ key: '1', label: 'Agree', total: 30 }],
  grandTotal: 50,
  isMetric: false,
  isGrid: false,
  isMultipleResponse: false,
  rowVariables: [],
  colVariable: null,
};

const goldenMaterializedDeck: MaterializedDeck = {
  title: 'Sleep Report',
  sections: [{ id: 'section-main', title: 'Main findings' }],
  slides: [
    {
      slideId: 'slide-awareness',
      label: 'Brand Awareness by Segment',
      sectionId: 'section-main',
      result: processedFixture,
      visualizationType: 'table',
      options: { showSignificance: true, showPercents: true, showCounts: false },
    },
    {
      slideId: 'slide-consideration',
      label: 'Consideration Trend',
      sectionId: 'section-main',
      result: processedFixture,
      visualizationType: 'chart',
      chartType: 'vertical-bar',
      options: { showSignificance: false, showPercents: true, showCounts: true },
    },
  ],
};

describe('deck recipe export parity by construction', () => {
  it('preview model and export config share structural fields', () => {
    assertPreviewExportStructuralParity(goldenMaterializedDeck);
    const preview = buildDeckPreviewModel(goldenMaterializedDeck);
    const exportSnapshot = buildDeckExportStructuralSnapshot(goldenMaterializedDeck);
    expect(preview.slides.map((slide) => slide.title)).toEqual(exportSnapshot.slides.map((slide) => slide.label));
  });
});
