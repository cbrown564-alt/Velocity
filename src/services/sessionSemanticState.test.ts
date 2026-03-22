import { describe, expect, it } from 'vitest';

import type { VelocitySessionFile } from '../core/session';
import type { Dataset } from '../store';
import {
  captureImportedSessionSemanticState,
  selectExportSessionSemantic,
} from './sessionSemanticState';

function buildDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: 'dataset-1',
    name: 'sleep.sav',
    source: 'sav',
    rowCount: 271,
    variables: [
      { id: 'sex', name: 'sex', label: 'Sex', type: 'nominal', valueLabels: [], missingValues: {} },
      { id: 'problem', name: 'problem', label: 'Problem with sleep', type: 'nominal', valueLabels: [], missingValues: {} },
    ],
    ...overrides,
  } as Dataset;
}

function buildSessionFile(): VelocitySessionFile {
  return {
    formatVersion: 2,
    exportedAt: '2026-03-13T00:00:00.000Z',
    velocityVersion: 'dev',
    dataset: {
      originalFilename: 'sleep.sav',
      rowCount: 271,
      source: 'sav',
      fingerprint: {
        columnCount: 2,
        columnNames: ['sex', 'problem'],
      },
    },
    variables: [],
    variableSets: [],
    folders: [],
    transformLog: [],
    tableConfig: { rowVars: [], colVar: null },
    activeFilters: [],
    slides: [],
    sections: [],
    semantic: {
      annotations: {
        sex: {
          topic: 'demographics',
          measurementIntent: 'demographic',
          source: 'auto',
          confidence: 0.92,
          relatedVariables: ['problem'],
        },
      },
      concepts: [
        {
          id: 'concept-1',
          name: 'sleep_problem',
          aliases: ['sleep issues'],
          variableRefs: [{ datasetId: 'dataset-1', variableId: 'problem', matchConfidence: 0.8 }],
        },
      ],
    },
  };
}

describe('sessionSemanticState', () => {
  it('captures imported semantic state from a session file', () => {
    const captured = captureImportedSessionSemanticState(buildSessionFile());

    expect(captured).not.toBeNull();
    expect(captured?.dataset.originalFilename).toBe('sleep.sav');
    expect(captured?.semantic.annotations.sex.measurementIntent).toBe('demographic');
    expect(captured?.semantic.concepts[0].name).toBe('sleep_problem');
  });

  it('returns null when the imported session has no semantic block', () => {
    const sessionFile = buildSessionFile();
    delete sessionFile.semantic;

    expect(captureImportedSessionSemanticState(sessionFile)).toBeNull();
  });

  it('reuses imported semantic state when exporting the same dataset shape', () => {
    const imported = captureImportedSessionSemanticState(buildSessionFile());
    const exportedSemantic = selectExportSessionSemantic(buildDataset(), imported);

    expect(exportedSemantic).toEqual(imported?.semantic);

    exportedSemantic?.concepts[0].aliases.push('changed');
    expect(imported?.semantic.concepts[0].aliases).toEqual(['sleep issues']);
  });

  it('reuses imported semantic state when overlap stays above the handoff threshold', () => {
    const imported = captureImportedSessionSemanticState({
      ...buildSessionFile(),
      dataset: {
        ...buildSessionFile().dataset,
        fingerprint: {
          columnCount: 10,
          columnNames: ['sex', 'problem', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'synthetic_only'],
        },
      },
    });
    const dataset = buildDataset({
      variables: [
        { id: 'sex', name: 'sex', label: 'Sex', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'problem', name: 'problem', label: 'Problem with sleep', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'v3', name: 'v3', label: 'v3', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'v4', name: 'v4', label: 'v4', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'v5', name: 'v5', label: 'v5', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'v6', name: 'v6', label: 'v6', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'v7', name: 'v7', label: 'v7', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'v8', name: 'v8', label: 'v8', type: 'nominal', valueLabels: [], missingValues: {} },
        { id: 'v9', name: 'v9', label: 'v9', type: 'nominal', valueLabels: [], missingValues: {} },
      ],
    });

    expect(selectExportSessionSemantic(dataset, imported)).toEqual(imported?.semantic);
  });

  it('drops imported semantic state when the current dataset no longer matches', () => {
    const imported = captureImportedSessionSemanticState(buildSessionFile());
    const mismatchedDataset = buildDataset({
      rowCount: 300,
      variables: [{ id: 'sex', name: 'sex', label: 'Sex', type: 'nominal', valueLabels: [], missingValues: {} }],
    });

    expect(selectExportSessionSemantic(mismatchedDataset, imported)).toBeUndefined();
  });
});
