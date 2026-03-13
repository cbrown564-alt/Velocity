import type { SessionDatasetDescriptor, VelocitySessionFile } from '../core/session';
import type { Dataset } from '../store';
import type { SemanticSessionBlock } from '../types/semantic';

export interface ImportedSessionSemanticState {
  dataset: SessionDatasetDescriptor;
  semantic: SemanticSessionBlock;
}

function cloneDatasetDescriptor(dataset: SessionDatasetDescriptor): SessionDatasetDescriptor {
  return {
    ...dataset,
    fingerprint: {
      ...dataset.fingerprint,
      columnNames: [...dataset.fingerprint.columnNames],
    },
  };
}

function cloneSemanticBlock(semantic: SemanticSessionBlock): SemanticSessionBlock {
  return {
    annotations: Object.fromEntries(
      Object.entries(semantic.annotations).map(([variableId, annotation]) => [
        variableId,
        {
          ...annotation,
          relatedVariables: annotation.relatedVariables ? [...annotation.relatedVariables] : undefined,
        },
      ]),
    ),
    concepts: semantic.concepts.map((concept) => ({
      ...concept,
      aliases: [...concept.aliases],
      canonicalScale: concept.canonicalScale
        ? {
            ...concept.canonicalScale,
            anchors: concept.canonicalScale.anchors
              ? { ...concept.canonicalScale.anchors }
              : undefined,
          }
        : undefined,
      variableRefs: concept.variableRefs.map((ref) => ({ ...ref })),
    })),
  };
}

export function captureImportedSessionSemanticState(
  sessionFile: VelocitySessionFile,
): ImportedSessionSemanticState | null {
  if (!sessionFile.semantic) return null;

  return {
    dataset: cloneDatasetDescriptor(sessionFile.dataset),
    semantic: cloneSemanticBlock(sessionFile.semantic),
  };
}

export function selectExportSessionSemantic(
  dataset: Dataset,
  importedState: ImportedSessionSemanticState | null | undefined,
): SemanticSessionBlock | undefined {
  if (!importedState) return undefined;
  if (dataset.rowCount !== importedState.dataset.rowCount) return undefined;
  if (dataset.source !== importedState.dataset.source) return undefined;

  const currentVariableIds = new Set(dataset.variables.map((variable) => variable.id));
  let matchingColumns = 0;
  for (const variableId of importedState.dataset.fingerprint.columnNames) {
    if (currentVariableIds.has(variableId)) {
      matchingColumns += 1;
    }
  }
  const overlapRatio =
    importedState.dataset.fingerprint.columnNames.length === 0
      ? 1
      : matchingColumns / importedState.dataset.fingerprint.columnNames.length;
  if (overlapRatio < 0.9) return undefined;

  return cloneSemanticBlock(importedState.semantic);
}
