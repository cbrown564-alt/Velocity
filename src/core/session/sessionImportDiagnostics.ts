import type { SessionImportDiagnosticsSummary } from './sessionImporter';

export interface SessionImportDiagnosticMessage {
  id: string;
  message: string;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function wasOrWere(count: number): 'was' | 'were' {
  return count === 1 ? 'was' : 'were';
}

export function hasSessionImportDiagnostics(diagnostics: SessionImportDiagnosticsSummary): boolean {
  return (
    diagnostics.missingVariableIds.length > 0 ||
    diagnostics.droppedVariableSetIds.length > 0 ||
    diagnostics.droppedFilterIds.length > 0 ||
    diagnostics.droppedRowVarIds.length > 0 ||
    diagnostics.droppedColVarIds.length > 0 ||
    diagnostics.missingSectionIds.length > 0 ||
    diagnostics.skippedTransforms > 0 ||
    diagnostics.fallbackVariableSetsGenerated
  );
}

export function listSessionImportDiagnostics(
  diagnostics: SessionImportDiagnosticsSummary
): SessionImportDiagnosticMessage[] {
  const messages: SessionImportDiagnosticMessage[] = [];

  if (diagnostics.missingVariableIds.length > 0) {
    messages.push({
      id: 'missing-variable-ids',
      message: `${pluralize(diagnostics.missingVariableIds.length, 'variable')} could not be resolved.`,
    });
  }

  if (diagnostics.droppedVariableSetIds.length > 0) {
    const count = diagnostics.droppedVariableSetIds.length;
    messages.push({
      id: 'dropped-variable-set-ids',
      message: `${pluralize(count, 'variable set')} ${wasOrWere(count)} removed.`,
    });
  }

  if (diagnostics.droppedFilterIds.length > 0) {
    const count = diagnostics.droppedFilterIds.length;
    messages.push({
      id: 'dropped-filter-ids',
      message: `${pluralize(count, 'filter')} ${wasOrWere(count)} removed.`,
    });
  }

  if (diagnostics.droppedRowVarIds.length > 0) {
    const count = diagnostics.droppedRowVarIds.length;
    messages.push({
      id: 'dropped-row-var-ids',
      message: `${pluralize(count, 'row assignment')} ${wasOrWere(count)} removed.`,
    });
  }

  if (diagnostics.droppedColVarIds.length > 0) {
    const count = diagnostics.droppedColVarIds.length;
    messages.push({
      id: 'dropped-col-var-ids',
      message: `${pluralize(count, 'column assignment')} ${wasOrWere(count)} removed.`,
    });
  }

  if (diagnostics.missingSectionIds.length > 0) {
    const count = diagnostics.missingSectionIds.length;
    messages.push({
      id: 'missing-section-ids',
      message: `${pluralize(count, 'slide section reference')} ${wasOrWere(count)} removed.`,
    });
  }

  if (diagnostics.skippedTransforms > 0) {
    const count = diagnostics.skippedTransforms;
    messages.push({
      id: 'skipped-transforms',
      message: `${pluralize(count, 'unsupported transform')} ${wasOrWere(count)} skipped.`,
    });
  }

  if (diagnostics.fallbackVariableSetsGenerated) {
    messages.push({
      id: 'fallback-variable-sets-generated',
      message: 'Fallback variable sets were generated from the uploaded dataset.',
    });
  }

  return messages;
}
