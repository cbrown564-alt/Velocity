import type { VariableSet } from '../../types/dataset';
import type { Slide } from '../../types/slides';
import type { VelocitySessionFile } from './sessionTypes';
import { hasSessionImportDiagnostics, listSessionImportDiagnostics } from './sessionImportDiagnostics';
import type { SessionImportDiagnosticsSummary } from './sessionImporter';

export interface SessionImportRailSummary {
  slideCount: number;
  hasAdjustments: boolean;
  unresolvedVariableLabels: string[];
  affectedSlideNumbers: number[];
  adjustmentMessages: Array<{ id: string; message: string }>;
}

function resolveVariableLabel(id: string, variableSets: VariableSet[]): string {
  const set = variableSets.find((item) => item.id === id);
  return set?.name || id;
}

function resolveVariableIdLabel(id: string, variableSets: VariableSet[]): string {
  for (const set of variableSets) {
    if (set.variableIds.includes(id)) return set.name || id;
  }
  return id;
}

function collectUnresolvedVariableLabels(
  diagnostics: SessionImportDiagnosticsSummary,
  variableSets: VariableSet[],
): string[] {
  const labels = new Set<string>();
  for (const setId of diagnostics.droppedVariableSetIds) labels.add(resolveVariableLabel(setId, variableSets));
  for (const setId of diagnostics.droppedRowVarIds) labels.add(resolveVariableLabel(setId, variableSets));
  for (const setId of diagnostics.droppedColVarIds) labels.add(resolveVariableLabel(setId, variableSets));
  for (const variableId of diagnostics.missingVariableIds) labels.add(resolveVariableIdLabel(variableId, variableSets));
  return [...labels];
}

export function findAffectedSlideNumbers(
  originalSlides: Slide[],
  diagnostics: SessionImportDiagnosticsSummary,
): number[] {
  const droppedSetIds = new Set([
    ...diagnostics.droppedVariableSetIds,
    ...diagnostics.droppedRowVarIds,
    ...diagnostics.droppedColVarIds,
  ]);
  const missingVariableIds = new Set(diagnostics.missingVariableIds);
  const affected = new Set<number>();
  originalSlides.forEach((slide, index) => {
    const state = slide.analysisState ?? { rowVars: [], colVar: null, filters: [], weightVar: null };
    const hasIssue =
      state.rowVars.some((rowVarId) => droppedSetIds.has(rowVarId)) ||
      (state.colVar ? droppedSetIds.has(state.colVar) : false) ||
      state.filters.some((filter) => missingVariableIds.has(filter.variableId)) ||
      (state.weightVar ? missingVariableIds.has(state.weightVar) : false);
    if (hasIssue) affected.add(index + 1);
  });
  return [...affected].sort((a, b) => a - b);
}

export function buildSessionImportRailSummary(
  sessionFile: VelocitySessionFile,
  importedSlides: Slide[],
  diagnostics: SessionImportDiagnosticsSummary,
): SessionImportRailSummary {
  const variableSets = sessionFile.variableSets ?? [];
  const hasAdjustments = hasSessionImportDiagnostics(diagnostics);
  return {
    slideCount: importedSlides.length,
    hasAdjustments,
    unresolvedVariableLabels: collectUnresolvedVariableLabels(diagnostics, variableSets),
    affectedSlideNumbers: hasAdjustments ? findAffectedSlideNumbers(sessionFile.slides ?? [], diagnostics) : [],
    adjustmentMessages: hasAdjustments ? listSessionImportDiagnostics(diagnostics) : [],
  };
}
