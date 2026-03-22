import { describe, expect, it } from 'vitest';
import type { AnalysisSettings, Filter, TableConfig } from '../../store/slices/analysisSlice';
import type { DataTransform, Dataset, Folder, VariableSet } from '../../store/slices/dataSlice';
import type { Slide, SlideSection } from '../../types/slides';
import { exportSession } from './sessionExporter';
import { importSession } from './sessionImporter';

const exportedDataset: Dataset = {
  id: 'dataset-original',
  name: 'wave7_2024.sav',
  rowCount: 4892,
  source: 'sav',
  weightVariable: 'weight',
  opfsFileKey: 'opfs://device-specific-key',
  variables: [
    {
      id: 'q1',
      name: 'Q1',
      label: 'Brand Awareness',
      type: 'categorical',
      valueLabels: [
        { value: 1, label: 'Yes' },
        { value: 2, label: 'No' },
      ],
      missingValues: {},
    },
    {
      id: 'q2',
      name: 'Q2',
      label: 'Satisfaction',
      type: 'ordered',
      orderedStyle: 'rating',
      orderedScoring: 'allow_numeric_stats',
      valueLabels: [
        { value: 1, label: 'Very dissatisfied' },
        { value: 5, label: 'Very satisfied' },
      ],
      missingValues: {},
    },
    {
      id: 'q2_top2',
      name: 'Q2_TOP2',
      label: 'Top-2 Box',
      type: 'categorical',
      valueLabels: [
        { value: 0, label: 'Other' },
        { value: 1, label: 'Top-2' },
      ],
      missingValues: {},
    },
    {
      id: 'weight',
      name: 'WEIGHT',
      label: 'Weight',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
    },
  ],
};

const variableSets: VariableSet[] = [
  {
    id: 'set-q1',
    name: 'Awareness',
    variableIds: ['q1'],
    structure: 'single',
    type: 'categorical',
    folderId: 'folder-main',
    order: 0,
  },
  {
    id: 'set-q2',
    name: 'Satisfaction',
    variableIds: ['q2'],
    structure: 'single',
    type: 'ordered',
    orderedStyle: 'rating',
    orderedScoring: 'allow_numeric_stats',
    folderId: 'folder-main',
    order: 1,
  },
  {
    id: 'set-top2',
    name: 'Top-2 Box',
    variableIds: ['q2_top2'],
    structure: 'single',
    type: 'categorical',
    folderId: 'folder-derived',
    order: 0,
    derived: true,
  },
];

const folders: Folder[] = [
  { id: 'folder-main', name: 'Core', order: 0 },
  { id: 'folder-derived', name: 'Derived', order: 1 },
];

const transformLog: DataTransform[] = [
  {
    type: 'recode',
    sourceColId: 'q2',
    newColId: 'q2_top2',
    label: 'Top-2 Box',
    config: {
      mode: 'binning',
      rules: [{ min: 4, max: 6, label: 'Top-2' }],
    },
    createdAt: 1700000000000,
  },
];

const tableConfig: TableConfig = {
  rowVars: ['set-q1', 'set-q2'],
  colVar: 'set-top2',
};

const activeFilters: Filter[] = [
  {
    id: 'f-awareness',
    variableId: 'q1',
    operator: 'eq',
    value: 1,
  },
];

const slides: Slide[] = [
  {
    id: 'slide-1',
    title: 'Awareness vs Top-2',
    subtitle: 'Wave 7',
    sectionId: 'section-main',
    analysisState: {
      rowVars: ['set-q1'],
      colVar: 'set-top2',
      filters: activeFilters,
      weightVar: 'weight',
    },
    visualizationType: 'table',
    layoutMode: 'focus',
    cells: [{ id: 'cell-1', content: { type: 'table' } }],
    createdAt: 1700000000001,
    updatedAt: 1700000000002,
  },
  {
    id: 'slide-2',
    title: 'Satisfaction',
    subtitle: '',
    sectionId: 'section-main',
    analysisState: {
      rowVars: ['set-q2'],
      colVar: null,
      filters: [],
      weightVar: 'weight',
    },
    visualizationType: 'chart',
    layoutMode: 'comparison',
    cells: [{ id: 'cell-2', content: { type: 'chart' } }],
    createdAt: 1700000000003,
    updatedAt: 1700000000004,
  },
];

const sections: SlideSection[] = [
  { id: 'section-main', title: 'Main Deck' },
];

const analysisSettings: Partial<AnalysisSettings> = {
  engine: 'auto',
  showConfidenceIntervals: true,
};

const loadedDatasetForImport: Dataset = {
  id: 'dataset-imported-runtime-id',
  name: 'sleep_1772118248912.sav',
  rowCount: 4892,
  source: 'sav',
  weightVariable: 'weight',
  variables: [
    {
      id: 'q1',
      name: 'Q1_RUNTIME',
      label: 'Runtime Label 1',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    },
    {
      id: 'q2',
      name: 'Q2_RUNTIME',
      label: 'Runtime Label 2',
      type: 'ordered',
      orderedStyle: 'rating',
      orderedScoring: 'allow_numeric_stats',
      valueLabels: [],
      missingValues: {},
    },
    {
      id: 'q2_top2',
      name: 'Q2_TOP2_RUNTIME',
      label: 'Runtime Derived',
      type: 'categorical',
      valueLabels: [],
      missingValues: {},
    },
    {
      id: 'weight',
      name: 'WEIGHT',
      label: 'Runtime Weight',
      type: 'numeric',
      valueLabels: [],
      missingValues: {},
    },
  ],
  opfsFileKey: 'opfs://new-runtime-key',
};

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeEquivalentState(input: {
  dataset: Dataset;
  variableSets: VariableSet[];
  folders: Folder[];
  transformLog: DataTransform[];
  tableConfig: TableConfig;
  activeFilters: Filter[];
  analysisSettings?: Partial<AnalysisSettings>;
  slides: Slide[];
  sections: SlideSection[];
  harmonizationSession: unknown;
}) {
  return {
    dataset: {
      rowCount: input.dataset.rowCount,
      source: input.dataset.source,
      weightVariable: input.dataset.weightVariable ?? null,
      variables: sortById(input.dataset.variables).map((variable) => ({
        id: variable.id,
        name: variable.name,
        label: variable.label,
        type: variable.type,
        orderedStyle: variable.orderedStyle,
        orderedScoring: variable.orderedScoring,
        synthetic: variable.synthetic,
        sourceGridId: variable.sourceGridId,
        valueLabels: [...variable.valueLabels],
        missingValues: {
          discrete: variable.missingValues.discrete ? [...variable.missingValues.discrete] : undefined,
          range: variable.missingValues.range
            ? {
              low: variable.missingValues.range.low,
              high: variable.missingValues.range.high,
            }
            : undefined,
        },
      })),
    },
    variableSets: sortById(input.variableSets).map((set) => ({
      ...set,
      variableIds: [...set.variableIds],
    })),
    folders: sortById(input.folders),
    transformLog: [...input.transformLog],
    tableConfig: {
      rowVars: [...input.tableConfig.rowVars],
      colVar: input.tableConfig.colVar,
    },
    activeFilters: sortById(input.activeFilters).map((filter) => ({
      ...filter,
      value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
    })),
    analysisSettings: input.analysisSettings ? { ...input.analysisSettings } : undefined,
    slides: sortById(input.slides).map((slide) => ({
      ...slide,
      cells: slide.cells.map((cell) => ({
        ...cell,
        layout: cell.layout ? { ...cell.layout } : undefined,
        content: { ...cell.content },
      })),
      analysisState: {
        rowVars: [...slide.analysisState.rowVars],
        colVar: slide.analysisState.colVar,
        filters: sortById(slide.analysisState.filters).map((filter) => ({
          ...filter,
          value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
        })),
        weightVar: slide.analysisState.weightVar,
      },
    })),
    sections: sortById(input.sections),
    harmonizationSession: input.harmonizationSession ?? null,
  };
}

describe('session export/import round trip', () => {
  it('round-trips equivalent state while ignoring ephemeral runtime fields', () => {
    const session = exportSession({
      dataset: exportedDataset,
      variableSets,
      folders,
      transformLog,
      tableConfig,
      activeFilters,
      analysisSettings,
      slides,
      sections,
      harmonizationSession: null,
      velocityVersion: '0.2.0',
      exportedAt: new Date('2026-02-26T18:00:00.000Z'),
    });

    const imported = importSession(session, loadedDatasetForImport);
    expect(session.weightVariable).toBe('weight');

    const expectedEquivalent = normalizeEquivalentState({
      dataset: exportedDataset,
      variableSets,
      folders,
      transformLog,
      tableConfig,
      activeFilters,
      analysisSettings,
      slides,
      sections,
      harmonizationSession: null,
    });

    const actualEquivalent = normalizeEquivalentState({
      dataset: imported.patch.dataset,
      variableSets: imported.patch.variableSets,
      folders: imported.patch.folders,
      transformLog: imported.patch.transformLog,
      tableConfig: imported.patch.tableConfig,
      activeFilters: imported.patch.activeFilters,
      analysisSettings: imported.patch.analysisSettings,
      slides: imported.patch.slides,
      sections: imported.patch.sections,
      harmonizationSession: imported.patch.harmonizationSession,
    });

    expect(actualEquivalent).toEqual(expectedEquivalent);
    expect(imported.patch.activeSlideId).toBe('slide-1');
    expect(imported.diagnostics).toEqual({
      missingVariableIds: [],
      droppedVariableSetIds: [],
      droppedFilterIds: [],
      droppedRowVarIds: [],
      droppedColVarIds: [],
      missingSectionIds: [],
      skippedTransforms: 0,
      fallbackVariableSetsGenerated: false,
    });

    // Runtime-only dataset fields should remain from the fresh upload.
    expect(imported.patch.dataset.id).toBe('dataset-imported-runtime-id');
    expect(imported.patch.dataset.name).toBe('sleep_1772118248912.sav');
    expect(imported.patch.dataset.opfsFileKey).toBe('opfs://new-runtime-key');
  });
});
