import { describe, expect, it } from 'vitest';
import type { Dataset, Folder, VariableSet } from '../../store/slices/dataSlice';
import type { Filter, TableConfig } from '../../store/slices/analysisSlice';
import type { Slide } from '../../types/slides';
import { exportSession, serializeSessionFile } from './sessionExporter';

const datasetFixture: Dataset = {
  id: 'dataset-1',
  name: 'wave7_2024.sav',
  rowCount: 4892,
  source: 'sav',
  opfsFileKey: 'opfs://internal-key',
  variables: [
    {
      id: 'q1',
      name: 'Q1',
      label: 'Age Group',
      type: 'categorical',
      valueLabels: [
        { value: 1, label: '18-24' },
        { value: 2, label: '25-34' },
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
  ],
};

const variableSetsFixture: VariableSet[] = [
  {
    id: 'set-q1',
    name: 'Age',
    variableIds: ['q1'],
    structure: 'single',
    type: 'categorical',
  },
];

const foldersFixture: Folder[] = [{ id: 'folder-1', name: 'Demographics', order: 0 }];

const tableConfigFixture: TableConfig = {
  rowVars: ['set-q1'],
  colVar: null,
};

const filtersFixture: Filter[] = [
  {
    id: 'f-1',
    variableId: 'q1',
    operator: 'eq',
    value: 1,
  },
];

const slidesFixture: Slide[] = [
  {
    id: 'slide-1',
    title: 'Analysis 1',
    subtitle: '',
    analysisState: {
      rowVars: ['set-q1'],
      colVar: null,
      filters: filtersFixture,
      weightVar: null,
    },
    visualizationType: 'table',
    layoutMode: 'focus',
    cells: [{ id: 'cell-1', content: { type: 'table' } }],
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('exportSession', () => {
  it('exports the expected session recipe without OPFS internals', () => {
    const session = exportSession({
      dataset: datasetFixture,
      variableSets: variableSetsFixture,
      folders: foldersFixture,
      transformLog: [],
      tableConfig: tableConfigFixture,
      activeFilters: filtersFixture,
      slides: slidesFixture,
      sections: [],
      analysisSettings: { engine: 'auto' },
      velocityVersion: '0.1.0',
      exportedAt: new Date('2026-02-26T15:00:00.000Z'),
    });

    expect(session.formatVersion).toBe(2);
    expect(session.exportedAt).toBe('2026-02-26T15:00:00.000Z');
    expect(session.dataset).toEqual({
      originalFilename: 'wave7_2024.sav',
      rowCount: 4892,
      source: 'sav',
      fingerprint: {
        columnCount: 2,
        columnNames: ['q1', 'q2'],
        checksum: undefined,
      },
    });
    expect('opfsFileKey' in (session.dataset as Record<string, unknown>)).toBe(false);
    expect(session.variables).toHaveLength(2);
    expect(session.variableSets).toHaveLength(1);
    expect(session.workspace).toBeUndefined();
  });

  it('includes workspace snapshot when multiple datasets/projects exist', () => {
    const session = exportSession({
      dataset: datasetFixture,
      variableSets: variableSetsFixture,
      folders: foldersFixture,
      transformLog: [],
      tableConfig: tableConfigFixture,
      activeFilters: [],
      slides: slidesFixture,
      sections: [],
      workspace: {
        datasets: [
          { id: 'dataset-1', name: 'wave7_2024.sav', rowCount: 4892, waveNumber: 1 },
          { id: 'dataset-2', name: 'wave8_2025.sav', rowCount: 5010, waveNumber: 2 },
        ],
        projects: [
          {
            id: 'project-1',
            name: 'Brand Tracker',
            color: '#00AAEE',
            createdAt: 1,
            datasetIds: ['dataset-1', 'dataset-2'],
            isLongitudinal: true,
          },
        ],
      },
      activeDatasetId: 'dataset-1',
    });

    expect(session.workspace).toBeDefined();
    expect(session.workspace?.projects).toHaveLength(1);
    expect(session.workspace?.datasetLinks).toEqual([
      { datasetFilename: 'wave7_2024.sav', datasetRowCount: 4892, role: 'wave_1' },
      { datasetFilename: 'wave8_2025.sav', datasetRowCount: 5010, role: 'wave_2' },
    ]);
  });

  it('serializes to readable JSON by default', () => {
    const session = exportSession({
      dataset: datasetFixture,
      variableSets: variableSetsFixture,
      folders: foldersFixture,
      transformLog: [],
      tableConfig: tableConfigFixture,
      activeFilters: [],
      slides: slidesFixture,
      sections: [],
    });

    const serialized = serializeSessionFile(session);
    expect(serialized).toContain('\n');
    expect(serialized).toContain('"formatVersion": 2');
  });

  it('excludes transform-generated columns from dataset fingerprint', () => {
    const session = exportSession({
      dataset: {
        ...datasetFixture,
        variables: [
          ...datasetFixture.variables,
          {
            id: 'q2_top2',
            name: 'Q2_TOP2',
            label: 'Top-2 Box',
            type: 'categorical',
            valueLabels: [],
            missingValues: {},
          },
        ],
      },
      variableSets: [
        ...variableSetsFixture,
        {
          id: 'set-q2-top2',
          name: 'Top-2 Box',
          variableIds: ['q2_top2'],
          structure: 'single',
          type: 'categorical',
        },
      ],
      folders: foldersFixture,
      transformLog: [
        {
          type: 'recode',
          sourceColId: 'q2',
          newColId: 'q2_top2',
          label: 'Top-2 Box',
          config: {
            rules: [{ from: [4, 5], to: 1 }],
            elseValue: 0,
            valueLabels: [],
            preserveMissing: true,
          },
          createdAt: 1,
        },
      ],
      tableConfig: tableConfigFixture,
      activeFilters: [],
      slides: slidesFixture,
      sections: [],
    });

    expect(session.dataset.fingerprint).toEqual({
      columnCount: 2,
      columnNames: ['q1', 'q2'],
      checksum: undefined,
    });
    expect(session.variables.map((variable) => variable.id)).toContain('q2_top2');
  });
});
