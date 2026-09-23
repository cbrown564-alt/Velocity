import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVelocityStore } from './index';
import type { Filter } from '../types';
import { mockDataset, mockNominalSet, mockNominalVariable, makeVariable } from '../test/fixtures/variables';
import { exportSession, serializeSessionFile } from '../core/session/sessionExporter';
import { importSession } from '../core/session/sessionImporter';
import { materializeDeckRecipe } from '../core/export/materializeDeckRecipe';
import { exportMaterializedDeck } from '../core/export/exportDeckRecipe';
import ExcelJS from 'exceljs';
import { defaultAnalysisSettings } from './slices/analysisSlice';

function mockEngineProxy() {
  const mockEnvelope = (data: unknown) => ({
    data,
    operation: 'test',
    inputs: {},
    durationMs: 10,
    warnings: [],
    metadata: {
      datasetName: 'test.sav',
      rowCount: 100,
      filtersApplied: 0,
      isWeighted: false,
      engineVersion: 'browser-wasm',
    },
  });

  const mockRunAnalysis = vi.fn().mockResolvedValue(mockEnvelope({ rows: [], tableStats: null }));
  return {
    browserEngine: {
      runAnalysis: mockRunAnalysis,
      getVariableStats: vi.fn().mockResolvedValue(mockEnvelope({})),
    } as any,
    mockRunCrosstab: mockRunAnalysis,
  };
}

describe('slidesSlice', () => {
  beforeEach(() => {
    // Reset slides state to initial value with a single slide
    useVelocityStore.setState({
      slides: [
        {
          id: 'slide-test-1',
          title: 'New Slide',
          subtitle: '',
          analysisState: {
            rowVars: [],
            colVar: null,
            filters: [],
            weightVar: null,
          },
          visualizationType: 'table' as const,
          layoutMode: 'focus' as const,
          cells: [{ id: 'cell-test-1', content: { type: 'table' as const } }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeSlideId: 'slide-test-1',
      activeCellId: 'cell-test-1',
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      dataset: null,
      analysisSettings: { ...defaultAnalysisSettings },
    });
  });

  describe('getDeckRecipe', () => {
    it('returns the canonical deck recipe from slide content state', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => result.current.updateSlideTitle('slide-test-1', 'Awareness'));
      expect(result.current.getDeckRecipe({ title: 'Tracker deck' }).slideRecipes[0].title).toBe('Awareness');
    });

    it('uses the live active analysis before an explicit snapshot', () => {
      const state = useVelocityStore.getState();
      const filter: Filter = { id: 'filter-region', variableId: 'region', operator: 'eq', value: 1 };
      useVelocityStore.setState({
        tableConfig: { rowVars: ['awareness'], colVar: 'segment' },
        activeFilters: [filter],
        dataset: {
          id: 'dataset',
          name: 'test.sav',
          rowCount: 10,
          source: 'sav',
          variables: [],
          weightVariable: 'weight',
        },
      });

      const recipe = state.getDeckRecipe();
      expect(recipe.slideRecipes[0].analysisState).toEqual({
        rowVars: ['awareness'],
        colVar: 'segment',
        filters: [filter],
        weightVar: 'weight',
      });
      expect(useVelocityStore.getState().slides[0].analysisState.rowVars).toEqual([]);
    });
  });

  it('runs, reopens, and materializes one saved analysis with the same recipe and labeled results', async () => {
    const dataset = {
      ...mockDataset,
      id: 'saved-analysis-source',
      variables: [mockNominalVariable, makeVariable({ id: 'weight', name: 'Weight', type: 'numeric' })],
      weightVariable: 'weight',
    };
    const filter: Filter = { id: 'filter-gender', variableId: mockNominalVariable.id, operator: 'eq', value: 1 };
    const settings = {
      ...defaultAnalysisSettings,
      comparisonMethod: 'pairwise' as const,
      correctionType: 'fdr' as const,
      significanceLevel: 0.8 as const,
    };
    const { browserEngine, mockRunCrosstab } = mockEngineProxy();
    useVelocityStore.setState({
      dataset,
      variableSets: [mockNominalSet],
      browserEngine,
      tableConfig: { rowVars: [mockNominalSet.id], colVar: null },
      activeFilters: [filter],
      analysisSettings: settings,
    });

    await useVelocityStore.getState().runAnalysis();
    expect(mockRunCrosstab).toHaveBeenCalledOnce();
    const firstRun = mockRunCrosstab.mock.calls[0][1];
    expect(firstRun).toMatchObject({
      rowVars: [mockNominalSet.id],
      filters: [filter],
      weightVar: 'weight',
      analysisSettings: settings,
    });

    const initialRecipe = useVelocityStore.getState().getDeckRecipe();
    useVelocityStore.getState().snapshotCurrentSlide();
    const saved = useVelocityStore.getState();
    const file = exportSession({
      dataset,
      variableSets: saved.variableSets,
      folders: saved.folders,
      transformLog: saved.transformLog,
      tableConfig: saved.tableConfig,
      activeFilters: saved.activeFilters,
      analysisSettings: saved.analysisSettings,
      slides: saved.slides,
      sections: saved.sections,
    });
    const reopened = importSession(JSON.parse(serializeSessionFile(file)), {
      ...dataset,
      id: 'saved-analysis-reopened',
    });
    const reopenedSlide = reopened.patch.slides[0];
    expect(reopenedSlide.analysisState).toEqual(initialRecipe.slideRecipes[0].analysisState);
    expect(reopenedSlide.analysisSettings).toEqual(settings);
    expect(reopened.patch.dataset.variables[0].valueLabels).toEqual(mockNominalVariable.valueLabels);

    useVelocityStore.setState({
      dataset: reopened.patch.dataset,
      variableSets: reopened.patch.variableSets,
      slides: reopened.patch.slides,
      sections: reopened.patch.sections,
      activeSlideId: reopened.patch.activeSlideId,
      analysisSettings: reopenedSlide.analysisSettings!,
    });
    useVelocityStore.getState().applySlideAnalysisState(reopenedSlide.analysisState, { runAnalysis: false });
    await useVelocityStore.getState().runAnalysis();
    expect(mockRunCrosstab).toHaveBeenCalledTimes(2);
    expect(mockRunCrosstab.mock.calls[1][1]).toMatchObject(firstRun);
    expect(useVelocityStore.getState().getDeckRecipe().slideRecipes).toEqual(initialRecipe.slideRecipes);

    const rawRows = [
      { rowKey_0: 1, colKey: 'Total', count: 4, weightedCount: 6 },
      { rowKey_0: 2, colKey: 'Total', count: 3, weightedCount: 5 },
    ];
    const exportEngine = {
      runCrosstab: vi.fn().mockResolvedValue({ data: { rows: rawRows, tableStats: null } }),
    };
    const beforeExport = await materializeDeckRecipe({
      recipe: initialRecipe,
      engine: exportEngine,
      dataset,
      variableSets: [mockNominalSet],
      analysisSettings: settings,
    });
    const afterExport = await materializeDeckRecipe({
      recipe: useVelocityStore.getState().getDeckRecipe(),
      engine: exportEngine,
      dataset: reopened.patch.dataset,
      variableSets: reopened.patch.variableSets,
      analysisSettings: reopenedSlide.analysisSettings,
    });
    expect(afterExport).toEqual(beforeExport);
    expect(afterExport.slides).toHaveLength(1);
    expect(afterExport.slides[0].result.rows.map((row) => row.label)).toEqual(['Male', 'Female', 'Non-binary']);
    expect(exportEngine.runCrosstab.mock.calls[1]).toEqual(exportEngine.runCrosstab.mock.calls[0]);
    const beforeXlsx = await exportMaterializedDeck(beforeExport, 'xlsx');
    const afterXlsx = await exportMaterializedDeck(afterExport, 'xlsx');
    const beforeWorkbook = new ExcelJS.Workbook();
    const afterWorkbook = new ExcelJS.Workbook();
    await beforeWorkbook.xlsx.load(Buffer.from(beforeXlsx));
    await afterWorkbook.xlsx.load(Buffer.from(afterXlsx));
    expect(afterWorkbook.worksheets.map((sheet) => sheet.getSheetValues())).toEqual(
      beforeWorkbook.worksheets.map((sheet) => sheet.getSheetValues()),
    );
    expect(afterWorkbook.worksheets[0].getCell('A5').value).toBe('Male');

    const unweightedRecipe = {
      ...initialRecipe,
      slideRecipes: initialRecipe.slideRecipes.map((slide) => ({
        ...slide,
        analysisState: { ...slide.analysisState, weightVar: null },
      })),
    };
    const unweightedExport = await materializeDeckRecipe({
      recipe: unweightedRecipe,
      engine: exportEngine,
      dataset,
      variableSets: [mockNominalSet],
      analysisSettings: settings,
    });
    expect(exportEngine.runCrosstab.mock.calls[2][0].weightVar).toBeUndefined();
    expect(unweightedExport.slides[0].result.grandTotal).toBe(7);
  });

  describe('addSlide', () => {
    it('should snapshot the active slide before switching to a blank slide', () => {
      const { result } = renderHook(() => useVelocityStore());

      act(() => {
        result.current.setTableConfig({ rowVars: ['impact'], colVar: 'segment' });
        result.current.addSlide();
      });

      const originalSlide = result.current.slides[0];
      const newSlide = result.current.slides[1];

      expect(originalSlide.analysisState).toEqual({
        rowVars: ['impact'],
        colVar: 'segment',
        filters: [],
        weightVar: null,
      });
      expect(newSlide.analysisState).toEqual({
        rowVars: [],
        colVar: null,
        filters: [],
        weightVar: null,
      });
      expect(result.current.activeSlideId).toBe(newSlide.id);
    });

    it('clears the previous analysis error when switching to the new blank slide', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => {
        useVelocityStore.setState({ queryError: 'Parser Error: unterminated quoted string' });
        result.current.addSlide();
      });

      expect(result.current.tableConfig.rowVars).toEqual([]);
      expect(result.current.queryError).toBeNull();
    });
  });

  describe('duplicateSlide', () => {
    it('should create a copy with a new ID', () => {
      const { result } = renderHook(() => useVelocityStore());

      // Get the initial slide
      const initialSlide = result.current.slides[0];
      const initialSlideCount = result.current.slides.length;

      act(() => {
        result.current.duplicateSlide(initialSlide.id);
      });

      expect(result.current.slides.length).toBe(initialSlideCount + 1);
      // New slide should have a different ID
      const newSlide = result.current.slides.find((s) => s.id !== initialSlide.id);
      expect(newSlide).toBeDefined();
      expect(newSlide!.id).not.toBe(initialSlide.id);
    });

    it('should append " (Copy)" to the title', () => {
      const { result } = renderHook(() => useVelocityStore());

      const initialSlide = result.current.slides[0];

      act(() => {
        result.current.duplicateSlide(initialSlide.id);
      });

      const duplicatedSlide = result.current.slides[1];
      expect(duplicatedSlide.title).toBe(`${initialSlide.title} (Copy)`);
    });

    it('should number repeated duplicates instead of chaining "(Copy) (Copy)"', () => {
      const { result } = renderHook(() => useVelocityStore());
      const initialSlide = result.current.slides[0];

      act(() => {
        result.current.duplicateSlide(initialSlide.id);
      });
      const firstCopy = result.current.slides.find((s) => s.title.endsWith('(Copy)'));
      expect(firstCopy).toBeDefined();

      act(() => {
        result.current.duplicateSlide(firstCopy!.id);
      });

      const secondCopy = result.current.slides.find((s) => s.title.endsWith('(Copy 2)'));
      expect(secondCopy?.title).toBe(`${initialSlide.title} (Copy 2)`);
    });

    it('should preserve analysisState', () => {
      const { result } = renderHook(() => useVelocityStore());

      // First update the slide's analysis state
      act(() => {
        // Set some table config that will be captured
        result.current.setTableConfig({ rowVars: ['var1', 'var2'], colVar: 'var3' });
        result.current.snapshotCurrentSlide();
      });

      const originalSlide = result.current.slides[0];

      act(() => {
        result.current.duplicateSlide(originalSlide.id);
      });

      const duplicatedSlide = result.current.slides[1];
      expect(duplicatedSlide.analysisState.rowVars).toEqual(originalSlide.analysisState.rowVars);
      expect(duplicatedSlide.analysisState.colVar).toBe(originalSlide.analysisState.colVar);
    });

    it('should insert after the original in array', () => {
      const { result } = renderHook(() => useVelocityStore());

      // Add a second slide
      act(() => {
        result.current.addSlide('Second Slide');
      });

      const firstSlideId = result.current.slides[0].id;

      act(() => {
        result.current.duplicateSlide(firstSlideId);
      });

      // The duplicate should be at index 1, not at the end
      expect(result.current.slides[1].title).toContain('(Copy)');
      expect(result.current.slides[2].title).toBe('Second Slide');
    });

    it('should activate the new duplicate', () => {
      const { result } = renderHook(() => useVelocityStore());

      const initialSlideId = result.current.slides[0].id;

      act(() => {
        result.current.duplicateSlide(initialSlideId);
      });

      const duplicatedSlide = result.current.slides.find((s) => s.title.includes('(Copy)'));
      expect(result.current.activeSlideId).toBe(duplicatedSlide!.id);
    });
  });

  describe('setActiveSlide', () => {
    it('should snapshot outgoing slide and project incoming slide config', () => {
      const { result } = renderHook(() => useVelocityStore());
      const filterA: Filter = {
        id: 'filter-a',
        variableId: 'region',
        operator: 'eq',
        value: 'North',
      };
      const filterB: Filter = {
        id: 'filter-b',
        variableId: 'age',
        operator: 'gt',
        value: 18,
      };

      act(() => {
        useVelocityStore.setState({
          slides: [
            {
              id: 'slide-1',
              title: 'Slide 1',
              subtitle: '',
              analysisState: {
                rowVars: ['impact'],
                colVar: null,
                filters: [],
                weightVar: null,
              },
              visualizationType: 'table',
              layoutMode: 'focus',
              cells: [{ id: 'cell-1', content: { type: 'table' } }],
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'slide-2',
              title: 'Slide 2',
              subtitle: '',
              analysisState: {
                rowVars: ['brand'],
                colVar: 'segment',
                filters: [filterA, filterB],
                weightVar: null,
              },
              visualizationType: 'chart',
              chartType: 'horizontal-bar',
              layoutMode: 'focus',
              cells: [{ id: 'cell-2', content: { type: 'chart', chartType: 'horizontal-bar' } }],
              createdAt: 2,
              updatedAt: 2,
            },
          ],
          activeSlideId: 'slide-1',
          activeCellId: 'cell-1',
          tableConfig: { rowVars: ['awareness'], colVar: 'wave' },
          activeFilters: [],
        });
      });

      act(() => {
        result.current.setActiveSlide('slide-2');
      });

      const outgoingSlide = result.current.slides.find((slide) => slide.id === 'slide-1');
      expect(outgoingSlide?.analysisState).toEqual({
        rowVars: ['awareness'],
        colVar: 'wave',
        filters: [],
        weightVar: null,
      });
      expect(result.current.activeSlideId).toBe('slide-2');
      expect(result.current.tableConfig).toEqual({ rowVars: ['brand'], colVar: 'segment' });
      expect(result.current.activeFilters).toHaveLength(2);
      expect(result.current.activeFilters[0]?.variableId).toBe('region');
      expect(result.current.activeFilters[1]?.variableId).toBe('age');
    });

    it('should trigger exactly one analysis run when switching slides with filters', async () => {
      const { result } = renderHook(() => useVelocityStore());
      const { browserEngine, mockRunCrosstab } = mockEngineProxy();
      const filterA: Filter = {
        id: 'filter-a',
        variableId: 'region',
        operator: 'eq',
        value: 'North',
      };
      const filterB: Filter = {
        id: 'filter-b',
        variableId: 'age',
        operator: 'gt',
        value: 18,
      };

      act(() => {
        useVelocityStore.setState({
          browserEngine,
          isDbReady: true,
          dataset: {
            id: 'ds1',
            name: 'test.sav',
            rowCount: 100,
            variables: [],
            source: 'sav',
          } as any,
          slides: [
            {
              id: 'slide-1',
              title: 'Slide 1',
              subtitle: '',
              analysisState: {
                rowVars: ['impact'],
                colVar: null,
                filters: [],
                weightVar: null,
              },
              visualizationType: 'table',
              layoutMode: 'focus',
              cells: [{ id: 'cell-1', content: { type: 'table' } }],
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'slide-2',
              title: 'Slide 2',
              subtitle: '',
              analysisState: {
                rowVars: ['brand'],
                colVar: 'segment',
                filters: [filterA, filterB],
                weightVar: null,
              },
              visualizationType: 'table',
              layoutMode: 'focus',
              cells: [{ id: 'cell-2', content: { type: 'table' } }],
              createdAt: 2,
              updatedAt: 2,
            },
          ],
          activeSlideId: 'slide-1',
          activeCellId: 'cell-1',
          tableConfig: { rowVars: ['impact'], colVar: null },
          activeFilters: [],
        });
      });

      mockRunCrosstab.mockClear();

      act(() => {
        result.current.setActiveSlide('slide-2');
      });

      await vi.waitFor(() => {
        expect(mockRunCrosstab).toHaveBeenCalledTimes(1);
      });
    });

    it('should no-op when activating the already active slide', () => {
      const { result } = renderHook(() => useVelocityStore());
      const { browserEngine, mockRunCrosstab } = mockEngineProxy();

      act(() => {
        useVelocityStore.setState({
          browserEngine,
          isDbReady: true,
          dataset: {
            id: 'ds1',
            name: 'test.sav',
            rowCount: 100,
            variables: [],
            source: 'sav',
          } as any,
          tableConfig: { rowVars: ['impact'], colVar: null },
        });
      });

      mockRunCrosstab.mockClear();

      act(() => {
        result.current.setActiveSlide('slide-test-1');
      });

      expect(mockRunCrosstab).not.toHaveBeenCalled();
    });

    it('should restore each slide weightVariable when switching (DESIGN-CONV-K2)', () => {
      const { result } = renderHook(() => useVelocityStore());

      act(() => {
        useVelocityStore.setState({
          dataset: {
            id: 'ds-1',
            name: 'test.sav',
            variables: [],
            variableSets: [],
            rowCount: 10,
            weightVariable: 'wt_a',
          } as never,
          slides: [
            {
              id: 'slide-1',
              title: 'Weighted A',
              subtitle: '',
              analysisState: {
                rowVars: ['q1'],
                colVar: 'seg',
                filters: [],
                weightVar: 'wt_a',
              },
              visualizationType: 'table',
              layoutMode: 'focus',
              cells: [{ id: 'cell-1', content: { type: 'table' } }],
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'slide-2',
              title: 'Unweighted B',
              subtitle: '',
              analysisState: {
                rowVars: ['q2'],
                colVar: null,
                filters: [],
                weightVar: null,
              },
              visualizationType: 'table',
              layoutMode: 'focus',
              cells: [{ id: 'cell-2', content: { type: 'table' } }],
              createdAt: 2,
              updatedAt: 2,
            },
          ],
          activeSlideId: 'slide-1',
          activeCellId: 'cell-1',
          tableConfig: { rowVars: ['q1'], colVar: 'seg' },
          activeFilters: [],
        });
      });

      act(() => {
        result.current.setActiveSlide('slide-2');
      });

      expect(result.current.dataset?.weightVariable).toBeUndefined();
      expect(result.current.slides.find((s) => s.id === 'slide-1')?.analysisState.weightVar).toBe('wt_a');

      act(() => {
        result.current.setActiveSlide('slide-1');
      });

      expect(result.current.dataset?.weightVariable).toBe('wt_a');
      expect(result.current.slides.find((s) => s.id === 'slide-2')?.analysisState.weightVar).toBeNull();
    });

    it('should restore per-slide analysisSettings when switching (DESIGN-CONV-K2)', () => {
      const { result } = renderHook(() => useVelocityStore());

      act(() => {
        useVelocityStore.setState({
          analysisSettings: {
            comparisonMethod: 'cell_vs_rest',
            correctionType: 'none',
            showConfidenceIntervals: false,
            showCellN: false,
            showColumnBases: false,
            significanceLevel: 0.95,
            engine: 'auto',
          },
          slides: [
            {
              id: 'slide-1',
              title: 'Defaults',
              subtitle: '',
              analysisState: {
                rowVars: ['q1'],
                colVar: null,
                filters: [],
                weightVar: null,
              },
              analysisSettings: {
                comparisonMethod: 'cell_vs_rest',
                correctionType: 'none',
                showConfidenceIntervals: false,
                showCellN: false,
                showColumnBases: false,
                significanceLevel: 0.95,
                engine: 'auto',
              },
              visualizationType: 'table',
              layoutMode: 'focus',
              cells: [{ id: 'cell-1', content: { type: 'table' } }],
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'slide-2',
              title: 'Bonferroni',
              subtitle: '',
              analysisState: {
                rowVars: ['q2'],
                colVar: null,
                filters: [],
                weightVar: null,
              },
              analysisSettings: {
                comparisonMethod: 'pairwise',
                correctionType: 'bonferroni',
                showConfidenceIntervals: true,
                showCellN: true,
                showColumnBases: true,
                significanceLevel: 0.9,
                engine: 'duckdb',
              },
              visualizationType: 'chart',
              chartType: 'horizontal-bar',
              layoutMode: 'focus',
              cells: [{ id: 'cell-2', content: { type: 'chart', chartType: 'horizontal-bar' } }],
              createdAt: 2,
              updatedAt: 2,
            },
          ],
          activeSlideId: 'slide-1',
          activeCellId: 'cell-1',
          tableConfig: { rowVars: ['q1'], colVar: null },
          activeFilters: [],
        });
      });

      act(() => {
        result.current.setActiveSlide('slide-2');
      });

      expect(result.current.analysisSettings).toEqual({
        comparisonMethod: 'pairwise',
        correctionType: 'bonferroni',
        showConfidenceIntervals: true,
        showCellN: true,
        showColumnBases: true,
        significanceLevel: 0.9,
        engine: 'duckdb',
      });

      act(() => {
        result.current.updateAnalysisSettings({ correctionType: 'fdr' });
      });
      act(() => {
        result.current.setActiveSlide('slide-1');
      });

      expect(result.current.analysisSettings.correctionType).toBe('none');
      expect(result.current.slides.find((s) => s.id === 'slide-2')?.analysisSettings?.correctionType).toBe('fdr');
    });
  });

  describe('removeSlide', () => {
    it('should prevent deletion of last slide', () => {
      const { result } = renderHook(() => useVelocityStore());

      // Should only have one slide initially
      expect(result.current.slides.length).toBe(1);
      const onlySlideId = result.current.slides[0].id;

      act(() => {
        result.current.removeSlide(onlySlideId);
      });

      // Should still have one slide
      expect(result.current.slides.length).toBe(1);
      expect(result.current.slides[0].id).toBe(onlySlideId);
    });

    it('should delete slide when more than one exists', () => {
      const { result } = renderHook(() => useVelocityStore());

      // Add a second slide
      act(() => {
        result.current.addSlide('Second Slide');
      });

      expect(result.current.slides.length).toBe(2);
      const firstSlideId = result.current.slides[0].id;

      act(() => {
        result.current.removeSlide(firstSlideId);
      });

      expect(result.current.slides.length).toBe(1);
      expect(result.current.slides[0].title).toBe('Second Slide');
    });

    it('should activate next slide when deleting active', () => {
      const { result } = renderHook(() => useVelocityStore());

      // Add second slide
      act(() => {
        result.current.addSlide('Second Slide');
      });

      expect(result.current.slides.length).toBe(2);

      // addSlide activates the new slide, so the second slide is active
      const secondSlide = result.current.slides[1];
      expect(result.current.activeSlideId).toBe(secondSlide.id);

      act(() => {
        result.current.removeSlide(secondSlide.id);
      });

      // Should activate remaining slide
      expect(result.current.slides.length).toBe(1);
      expect(result.current.activeSlideId).not.toBe(secondSlide.id);
      expect(result.current.activeSlideId).toBe(result.current.slides[0].id);
    });
  });
});
