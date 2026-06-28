import { describe, it, expect } from 'vitest';
import type { StoredDataset } from '../types';
import {
  buildActivityHeatmap,
  computeAmbientSearchHints,
  computeColorSignature,
  computeHarmonizationStatus,
  computeWaveDeltaPreview,
  computeWorkspaceCategoryChips,
  findWaveGaps,
  matchesVariableKeyword,
} from './workspaceLibrary';

const baseDataset = (overrides: Partial<StoredDataset> = {}): StoredDataset => ({
  id: 'ds-1',
  name: 'mock_data',
  fileName: 'mock_data.sav',
  rowCount: 100,
  columnCount: 10,
  fileSize: 1024,
  source: 'sav',
  createdAt: Date.now() - 7 * 86_400_000,
  lastOpenedAt: Date.now() - 86_400_000,
  lastModifiedAt: Date.now() - 3_600_000,
  starred: false,
  ...overrides,
});

describe('workspaceLibrary', () => {
  it('computeColorSignature favors warm hues for categorical-heavy datasets', () => {
    const sig = computeColorSignature([
      { id: '1', name: 'a', label: 'A', type: 'categorical', valueLabels: [], missingValues: {} },
      { id: '2', name: 'b', label: 'B', type: 'categorical', valueLabels: [], missingValues: {} },
    ]);
    expect(sig.label).toBe('categorical');
    expect(sig.warmth).toBeGreaterThan(0.6);
  });

  it('buildActivityHeatmap lights cells near recent timestamps', () => {
    const now = Date.now();
    const grid = buildActivityHeatmap(now, now, now - 2 * 86_400_000, now);
    const maxIntensity = Math.max(...grid.flat().map((c) => c.intensity));
    expect(maxIntensity).toBeGreaterThan(0.5);
  });

  it('computeAmbientSearchHints matches variable names', () => {
    const datasets = [
      baseDataset({
        variables: [
          { id: 'g', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} },
        ],
      }),
    ];
    const hints = computeAmbientSearchHints('gender', datasets, []);
    expect(hints.some((h) => h.message.includes('1 dataset'))).toBe(true);
  });

  it('computeWorkspaceCategoryChips surfaces unanalyzed count', () => {
    const chips = computeWorkspaceCategoryChips(
      [
        baseDataset(),
        baseDataset({
          id: 'ds-2',
          sessionState: { tableConfig: { rowVars: ['a'], colVar: 'b' }, activeFilters: [], transformLog: [] },
        }),
      ],
      [],
      Date.now(),
    );
    expect(chips.find((c) => c.id === 'unanalyzed')?.count).toBe(1);
  });

  it('computeHarmonizationStatus returns complete for overlapping waves', () => {
    const project = { id: 'p1', name: 'Panel', color: '#fff', createdAt: 0, datasetIds: [], isLongitudinal: true };
    const vars = [{ id: '1', name: 'age', label: 'Age', type: 'numeric' as const, valueLabels: [], missingValues: {} }];
    const status = computeHarmonizationStatus(project, [
      baseDataset({ projectId: 'p1', waveNumber: 1, variables: vars }),
      baseDataset({ id: 'ds-2', projectId: 'p1', waveNumber: 2, variables: vars }),
    ]);
    expect(status).toBe('complete');
  });

  it('findWaveGaps detects missing wave numbers', () => {
    expect(findWaveGaps([baseDataset({ waveNumber: 1 }), baseDataset({ id: 'ds-2', waveNumber: 3 })])).toEqual([2]);
  });

  it('computeWaveDeltaPreview compares column counts', () => {
    const delta = computeWaveDeltaPreview(
      baseDataset({
        columnCount: 15,
        variables: Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          name: `v${i}`,
          label: '',
          type: 'numeric' as const,
          valueLabels: [],
          missingValues: {},
        })),
      }),
      baseDataset({
        columnCount: 10,
        variables: Array.from({ length: 10 }, (_, i) => ({
          id: String(i),
          name: `v${i}`,
          label: '',
          type: 'numeric' as const,
          valueLabels: [],
          missingValues: {},
        })),
      }),
    );
    expect(delta.variableDelta).toBe(5);
  });

  it('matchesVariableKeyword is case-insensitive', () => {
    expect(
      matchesVariableKeyword(
        baseDataset({
          variables: [
            { id: '1', name: 'NPS', label: 'Net Promoter', type: 'numeric', valueLabels: [], missingValues: {} },
          ],
        }),
        'nps',
      ),
    ).toBe(true);
  });
});
