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
});
