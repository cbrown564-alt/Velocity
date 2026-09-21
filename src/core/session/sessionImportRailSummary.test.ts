import { describe, expect, it } from 'vitest';
import type { Slide } from '../../types/slides';
import type { VelocitySessionFile } from './sessionTypes';
import { buildSessionImportRailSummary, findAffectedSlideNumbers } from './sessionImportRailSummary';
import type { SessionImportDiagnosticsSummary } from './sessionImporter';

function createSlide(id: string, analysisState: Slide['analysisState']): Slide {
  const now = Date.now();
  return {
    id,
    title: `Slide ${id}`,
    subtitle: '',
    analysisState,
    visualizationType: 'table',
    layoutMode: 'focus',
    cells: [{ id: `${id}-cell`, content: { type: 'table' } }],
    createdAt: now,
    updatedAt: now,
  };
}
function emptyDiagnostics(): SessionImportDiagnosticsSummary {
  return {
    missingVariableIds: [],
    droppedVariableSetIds: [],
    droppedFilterIds: [],
    droppedRowVarIds: [],
    droppedColVarIds: [],
    missingSectionIds: [],
    droppedDeckRecipeSlideIds: [],
    skippedTransforms: 0,
    fallbackVariableSetsGenerated: false,
  };
}
describe('sessionImportRailSummary', () => {
  it('builds a clean import summary with slide count only', () => {
    const sessionFile = {
      slides: [createSlide('s1', { rowVars: ['gender'], colVar: 'region', filters: [], weightVar: null })],
      variableSets: [
        { id: 'gender', name: 'Q5_gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
      ],
    } as VelocitySessionFile;
    const summary = buildSessionImportRailSummary(sessionFile, sessionFile.slides, emptyDiagnostics());
    expect(summary.slideCount).toBe(1);
    expect(summary.hasAdjustments).toBe(false);
    expect(summary.unresolvedVariableLabels).toEqual([]);
    expect(summary.affectedSlideNumbers).toEqual([]);
    expect(summary.adjustmentMessages).toEqual([]);
  });

  it('maps unresolved variables to affected slide numbers', () => {
    const diagnostics: SessionImportDiagnosticsSummary = {
      ...emptyDiagnostics(),
      missingVariableIds: ['wt'],
      droppedRowVarIds: ['brand'],
    };
    const slides = [
      createSlide('s1', { rowVars: ['gender'], colVar: 'region', filters: [], weightVar: null }),
      createSlide('s2', { rowVars: ['brand'], colVar: 'region', filters: [], weightVar: 'wt' }),
    ];
    expect(findAffectedSlideNumbers(slides, diagnostics)).toEqual([2]);
  });

  it('surfaces dropped filters and weights in the rail summary', () => {
    const slides = [
      createSlide('s1', {
        rowVars: ['gender'],
        colVar: 'region',
        filters: [{ id: 'f-missing', variableId: 'seg_x', operator: 'eq', value: '1' }],
        weightVar: 'wt',
      }),
      createSlide('s2', { rowVars: ['gender'], colVar: 'region', filters: [], weightVar: null }),
    ];
    const diagnostics: SessionImportDiagnosticsSummary = {
      ...emptyDiagnostics(),
      missingVariableIds: ['seg_x', 'wt'],
      droppedFilterIds: ['f-missing'],
    };
    const sessionFile = {
      slides,
      variableSets: [
        { id: 'gender', name: 'Q5_gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'SEG', variableIds: ['v-r'], type: 'categorical', structure: 'single' },
      ],
    } as VelocitySessionFile;

    const summary = buildSessionImportRailSummary(sessionFile, slides, diagnostics);
    expect(summary.hasAdjustments).toBe(true);
    expect(summary.slideCount).toBe(2);
    expect(summary.unresolvedVariableLabels).toEqual(expect.arrayContaining(['seg_x', 'wt']));
    expect(summary.affectedSlideNumbers).toEqual([1]);
    expect(summary.adjustmentMessages.map((item) => item.id)).toEqual(
      expect.arrayContaining(['missing-variable-ids', 'dropped-filter-ids']),
    );
  });
});
