import { describe, expect, it } from 'vitest';
import type { SessionImportDiagnosticsSummary } from './sessionImporter';
import { hasSessionImportDiagnostics, listSessionImportDiagnostics } from './sessionImportDiagnostics';

function emptyDiagnostics(): SessionImportDiagnosticsSummary {
  return {
    missingVariableIds: [],
    droppedVariableSetIds: [],
    droppedFilterIds: [],
    droppedRowVarIds: [],
    droppedColVarIds: [],
    missingSectionIds: [],
    skippedTransforms: 0,
    fallbackVariableSetsGenerated: false,
  };
}

describe('sessionImportDiagnostics', () => {
  it('detects when a diagnostics payload is empty', () => {
    const diagnostics = emptyDiagnostics();
    expect(hasSessionImportDiagnostics(diagnostics)).toBe(false);
    expect(listSessionImportDiagnostics(diagnostics)).toEqual([]);
  });

  it('reports present diagnostics as user-facing messages', () => {
    const diagnostics: SessionImportDiagnosticsSummary = {
      missingVariableIds: ['q1'],
      droppedVariableSetIds: ['set1'],
      droppedFilterIds: ['filter1'],
      droppedRowVarIds: ['row1'],
      droppedColVarIds: ['col1'],
      missingSectionIds: ['section1'],
      skippedTransforms: 2,
      fallbackVariableSetsGenerated: true,
    };

    expect(hasSessionImportDiagnostics(diagnostics)).toBe(true);

    const messages = listSessionImportDiagnostics(diagnostics);
    expect(messages.map((item) => item.id)).toEqual([
      'missing-variable-ids',
      'dropped-variable-set-ids',
      'dropped-filter-ids',
      'dropped-row-var-ids',
      'dropped-col-var-ids',
      'missing-section-ids',
      'skipped-transforms',
      'fallback-variable-sets-generated',
    ]);
  });
});
