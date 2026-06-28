import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVelocityStore } from './index';
import type { Filter } from '../types';

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
    });
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
        const slideId = result.current.slides[0].id;
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
