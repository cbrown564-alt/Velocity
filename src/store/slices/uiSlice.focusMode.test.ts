import { describe, it, expect, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';

describe('UISlice — Focus Mode', () => {
  beforeEach(() => {
    useVelocityStore.setState({ focusMode: false });
  });

  it('defaults focusMode to false', () => {
    expect(useVelocityStore.getState().focusMode).toBe(false);
  });

  it('toggles focusMode on and off', () => {
    useVelocityStore.getState().toggleFocusMode();
    expect(useVelocityStore.getState().focusMode).toBe(true);

    useVelocityStore.getState().toggleFocusMode();
    expect(useVelocityStore.getState().focusMode).toBe(false);
  });

  it('sets focusMode explicitly', () => {
    useVelocityStore.getState().setFocusMode(true);
    expect(useVelocityStore.getState().focusMode).toBe(true);

    useVelocityStore.getState().setFocusMode(false);
    expect(useVelocityStore.getState().focusMode).toBe(false);
  });
});

describe('UISlice — Table Density', () => {
  beforeEach(() => {
    useVelocityStore.setState({ tableDensity: 'compact' });
  });

  it('defaults tableDensity to compact', () => {
    expect(useVelocityStore.getState().tableDensity).toBe('compact');
  });

  it('toggles density between compact and generous', () => {
    useVelocityStore.getState().toggleTableDensity();
    expect(useVelocityStore.getState().tableDensity).toBe('generous');

    useVelocityStore.getState().toggleTableDensity();
    expect(useVelocityStore.getState().tableDensity).toBe('compact');
  });

  it('sets density explicitly', () => {
    useVelocityStore.getState().setTableDensity('generous');
    expect(useVelocityStore.getState().tableDensity).toBe('generous');

    useVelocityStore.getState().setTableDensity('compact');
    expect(useVelocityStore.getState().tableDensity).toBe('compact');
  });
});

describe('UISlice — Toast Layer', () => {
  beforeEach(() => {
    useVelocityStore.setState({ toasts: [] });
  });

  it('defaults to empty toasts', () => {
    expect(useVelocityStore.getState().toasts).toEqual([]);
  });

  it('adds a toast with generated id', () => {
    useVelocityStore.getState().addToast({ message: 'Hello', type: 'info' });
    const toasts = useVelocityStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello');
    expect(toasts[0].type).toBe('info');
    expect(toasts[0].id).toBeDefined();
    expect(toasts[0].duration).toBe(4000);
  });

  it('allows custom duration', () => {
    useVelocityStore.getState().addToast({ message: 'Quick', type: 'warning', duration: 1000 });
    const toast = useVelocityStore.getState().toasts[0];
    expect(toast.duration).toBe(1000);
  });

  it('dismisses a toast by id', () => {
    useVelocityStore.getState().addToast({ message: 'A', type: 'info' });
    useVelocityStore.getState().addToast({ message: 'B', type: 'success' });
    const id = useVelocityStore.getState().toasts[0].id;
    useVelocityStore.getState().dismissToast(id);
    expect(useVelocityStore.getState().toasts).toHaveLength(1);
    expect(useVelocityStore.getState().toasts[0].message).toBe('B');
  });

  it('clears all toasts', () => {
    useVelocityStore.getState().addToast({ message: 'A', type: 'info' });
    useVelocityStore.getState().addToast({ message: 'B', type: 'error' });
    useVelocityStore.getState().clearToasts();
    expect(useVelocityStore.getState().toasts).toEqual([]);
  });

  it('replaces toasts with the same dedupeKey', () => {
    useVelocityStore.getState().addToast({
      dedupeKey: 'storage-reminder',
      message: 'First',
      type: 'info',
    });
    useVelocityStore.getState().addToast({
      dedupeKey: 'storage-reminder',
      message: 'Second',
      type: 'info',
    });
    const toasts = useVelocityStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Second');
  });

  it('caps the toast queue at two items', () => {
    useVelocityStore.getState().addToast({ message: 'One', type: 'info' });
    useVelocityStore.getState().addToast({ message: 'Two', type: 'info' });
    useVelocityStore.getState().addToast({ message: 'Three', type: 'info' });
    const messages = useVelocityStore.getState().toasts.map((t) => t.message);
    expect(messages).toEqual(['Two', 'Three']);
  });
});

describe('UISlice — Search Scope Boundaries', () => {
  beforeEach(() => {
    useVelocityStore.setState({ searchQuery: '', managerSearchQuery: '' });
  });

  it('keeps manager search isolated from canvas sidebar search', () => {
    useVelocityStore.getState().setSearchQuery('region');
    useVelocityStore.getState().setManagerSearchQuery('gender');

    expect(useVelocityStore.getState().searchQuery).toBe('region');
    expect(useVelocityStore.getState().managerSearchQuery).toBe('gender');
  });

  it('updates manager search without mutating canvas search', () => {
    useVelocityStore.getState().setSearchQuery('age');
    useVelocityStore.getState().setManagerSearchQuery('nps');

    expect(useVelocityStore.getState().searchQuery).toBe('age');
    expect(useVelocityStore.getState().managerSearchQuery).toBe('nps');
  });
});

describe('UISlice — App Mode & Modals', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      appMode: 'analysis',
      recodeModal: { isOpen: false, variable: null },
      filterModal: { isOpen: false },
      analysisExportModal: { isOpen: false, config: null },
      draggingId: null,
    });
  });

  it('sets and toggles app mode', () => {
    useVelocityStore.getState().setAppMode('variables');
    expect(useVelocityStore.getState().appMode).toBe('variables');

    useVelocityStore.getState().toggleAppMode();
    expect(useVelocityStore.getState().appMode).toBe('analysis');
  });

  it('clears bulk selection when leaving variable manager', () => {
    useVelocityStore.setState({ appMode: 'variables', selectedVariableSetIds: ['a', 'b'] });
    useVelocityStore.getState().toggleAppMode();
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual([]);
  });

  it('opens and closes recode, filter, and export modals', () => {
    const variable = {
      id: 'v1',
      name: 'Q1',
      label: 'Question 1',
      type: 'categorical' as const,
      valueLabels: [],
      missingValues: {},
    };
    useVelocityStore.getState().openRecodeModal(variable);
    expect(useVelocityStore.getState().recodeModal.isOpen).toBe(true);
    expect(useVelocityStore.getState().recodeModal.variable).toEqual(variable);
    useVelocityStore.getState().closeRecodeModal();
    expect(useVelocityStore.getState().recodeModal.isOpen).toBe(false);

    useVelocityStore.getState().openFilterModal();
    expect(useVelocityStore.getState().filterModal.isOpen).toBe(true);
    useVelocityStore.getState().closeFilterModal();
    expect(useVelocityStore.getState().filterModal.isOpen).toBe(false);

    const config = { title: 'Export', analyses: [] };
    useVelocityStore.getState().openAnalysisExportModal(config);
    expect(useVelocityStore.getState().analysisExportModal.isOpen).toBe(true);
    expect(useVelocityStore.getState().analysisExportModal.config).toEqual(config);
    useVelocityStore.getState().closeAnalysisExportModal();
    expect(useVelocityStore.getState().analysisExportModal.isOpen).toBe(false);
  });

  it('tracks dragging id', () => {
    useVelocityStore.getState().setDraggingId('var-1');
    expect(useVelocityStore.getState().draggingId).toBe('var-1');
    useVelocityStore.getState().setDraggingId(null);
    expect(useVelocityStore.getState().draggingId).toBeNull();
  });
});

describe('UISlice — Variable Set Selection', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      selectedVariableSetIds: [],
      lastSelectedId: null,
      activeFolderId: null,
      selectedDataSourceId: null,
      selectedVariableSetId: null,
      selectedVariableId: null,
    });
  });

  it('toggles single and multi selection', () => {
    useVelocityStore.getState().toggleVariableSetSelection('a');
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual(['a']);

    useVelocityStore.getState().toggleVariableSetSelection('a');
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual([]);

    useVelocityStore.getState().toggleVariableSetSelection('a', true);
    useVelocityStore.getState().toggleVariableSetSelection('b', true);
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual(['a', 'b']);
    useVelocityStore.getState().toggleVariableSetSelection('a', true);
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual(['b']);
  });

  it('selects range, single, all, and clears selection', () => {
    const allIds = ['a', 'b', 'c', 'd'];
    useVelocityStore.getState().toggleVariableSetSelection('a');
    useVelocityStore.getState().selectVariableSetRange('c', allIds);
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual(['a', 'b', 'c']);

    useVelocityStore.getState().selectSingleVariableSet('d');
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual(['d']);

    useVelocityStore.getState().selectAllVariableSets(['x', 'y']);
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual(['x', 'y']);

    useVelocityStore.getState().clearSelection();
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual([]);
    expect(useVelocityStore.getState().lastSelectedId).toBeNull();
  });

  it('cascades folder and miller column selection clears', () => {
    useVelocityStore.setState({
      selectedVariableSetIds: ['vs1'],
      lastSelectedId: 'vs1',
      selectedVariableSetId: 'vs1',
      selectedVariableId: 'v1',
    });

    useVelocityStore.getState().setActiveFolderId('folder-1');
    expect(useVelocityStore.getState().activeFolderId).toBe('folder-1');
    expect(useVelocityStore.getState().selectedVariableSetId).toBeNull();
    expect(useVelocityStore.getState().selectedVariableSetIds).toEqual([]);

    useVelocityStore.getState().setSelectedDataSourceId('ds-1');
    expect(useVelocityStore.getState().selectedDataSourceId).toBe('ds-1');
    expect(useVelocityStore.getState().activeFolderId).toBeNull();

    useVelocityStore.getState().setSelectedVariableSetId('vs2');
    expect(useVelocityStore.getState().selectedVariableSetId).toBe('vs2');
    expect(useVelocityStore.getState().selectedVariableId).toBeNull();

    useVelocityStore.getState().setSelectedVariableId('v2');
    expect(useVelocityStore.getState().selectedVariableId).toBe('v2');
  });
});

describe('UISlice — Facets, Banner, Palette, Onboarding', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      facetFilters: { types: [], statuses: [], qualities: [] },
      waveDetectionBanner: {
        isVisible: false,
        matchedDatasetId: null,
        matchedDatasetName: '',
        confidence: 0,
        reason: '',
      },
      commandPaletteOpen: false,
      shortcutsOpen: false,
      hasSeenAutoCrosstab: false,
      lastSeenTransformCount: -1,
      welcomeBackDismissed: false,
      hoveredVariableSetId: null,
    });
  });

  it('manages facet filters', () => {
    useVelocityStore.getState().setFacetFilters({ types: ['categorical'] });
    expect(useVelocityStore.getState().facetFilters.types).toEqual(['categorical']);
    useVelocityStore.getState().clearFacetFilters();
    expect(useVelocityStore.getState().facetFilters).toEqual({
      types: [],
      statuses: [],
      qualities: [],
    });
  });

  it('shows and dismisses wave detection banner', () => {
    useVelocityStore.getState().showWaveDetectionBanner({
      matchedDatasetId: 'ds-2',
      matchedDatasetName: 'Wave 2',
      confidence: 0.9,
      reason: 'name match',
    });
    expect(useVelocityStore.getState().waveDetectionBanner.isVisible).toBe(true);
    expect(useVelocityStore.getState().waveDetectionBanner.matchedDatasetName).toBe('Wave 2');

    useVelocityStore.getState().dismissWaveDetectionBanner();
    expect(useVelocityStore.getState().waveDetectionBanner.isVisible).toBe(false);
  });

  it('opens command palette and shortcuts reference', () => {
    useVelocityStore.getState().openCommandPalette();
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(true);
    useVelocityStore.getState().closeCommandPalette();
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(false);

    useVelocityStore.getState().openShortcuts();
    expect(useVelocityStore.getState().shortcutsOpen).toBe(true);
    useVelocityStore.getState().closeShortcuts();
    expect(useVelocityStore.getState().shortcutsOpen).toBe(false);
  });

  it('tracks onboarding and living inspector hover', () => {
    useVelocityStore.getState().markAutoCrosstabSeen();
    expect(useVelocityStore.getState().hasSeenAutoCrosstab).toBe(true);

    useVelocityStore.getState().touchLastActiveAt();
    expect(useVelocityStore.getState().lastActiveAt).toBeGreaterThan(0);

    useVelocityStore.getState().dismissWelcomeBack();
    expect(useVelocityStore.getState().welcomeBackDismissed).toBe(true);

    useVelocityStore.getState().markTransformsSeen(3);
    expect(useVelocityStore.getState().lastSeenTransformCount).toBe(3);

    useVelocityStore.getState().setHoveredVariableSetId('vs-hover');
    expect(useVelocityStore.getState().hoveredVariableSetId).toBe('vs-hover');
  });
});
