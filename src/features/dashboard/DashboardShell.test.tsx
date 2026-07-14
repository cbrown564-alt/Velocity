import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DashboardShell } from './DashboardShell';
import { useVelocityStore } from '../../store';
import type { Slide } from '../../types/slides';
import type { PersistenceManagerState } from '../../hooks/usePersistenceManager';

vi.mock('../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell-stub">{children}</div>,
}));

const noop = () => {};
const noopAsync = async () => {};

beforeAll(() => {
  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    }));
  }
});

function createSlide(overrides: Partial<Slide> = {}): Slide {
  const now = Date.now();
  return {
    id: overrides.id ?? `slide-${now}`,
    title: overrides.title ?? 'New Slide',
    subtitle: overrides.subtitle ?? '',
    analysisState: overrides.analysisState ?? {
      rowVars: [],
      colVar: null,
      filters: [],
      weightVar: null,
    },
    visualizationType: overrides.visualizationType ?? 'table',
    layoutMode: overrides.layoutMode ?? 'focus',
    cells: overrides.cells ?? [{ id: `cell-${now}`, content: { type: 'table' } }],
    sectionId: overrides.sectionId,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

const mockPersistence: PersistenceManagerState = {
  opfsAvailableLocal: true,
  opfsEstimate: null,
  opfsDbFiles: null,
  opfsDbListError: null,
  opfsDbPurgeError: null,
  opfsRehydrateError: null,
  restoreActionError: null,
  showPartialLoadNotice: false,
  persistentStorageGranted: null,
  opfsUsageMb: null,
  opfsQuotaMb: null,
  opfsUsagePct: null,
  opfsDbLabel: null,
  restoreWarning: null,
  restorationPromptWarning: null,
  opfsErrorHint: null,
  datasetVariableCount: 2,
  labeledVariableCount: 2,
  totalValueLabelCount: 4,
  estimatedCells: 200,
  memoryRisk: 'normal',
  partialLoadMessage: null,
  rebuildFromOpfsSource: noopAsync,
  attemptRestoreFromPersistence: () => false,
  handleDismissPartialLoadNotice: noop,
  refreshOpfsDbFiles: noopAsync,
  purgeQuarantinedDbs: noopAsync,
  setShowPartialLoadNotice: noop,
};

const shellProps = {
  persistence: mockPersistence,
  onReturnToWorkspace: noop,
  onOpenSessionImport: noop,
  onExportSession: noop,
};

describe('DashboardShell (WP2.1 / WP2.3)', () => {
  beforeEach(() => {
    const slide1 = createSlide({ id: 'slide-1', title: 'Awareness by segment' });
    const slide2 = createSlide({ id: 'slide-2', title: 'Second slide' });
    useVelocityStore.setState({
      appMode: 'analysis',
      isWorkspaceMode: false,
      slides: [slide1, slide2],
      activeSlideId: 'slide-1',
      activeCellId: slide1.cells[0].id,
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      queryResult: [],
      variableSets: [
        { id: 'gender', name: 'Q5_gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'SEG', variableIds: ['v-r'], type: 'categorical', structure: 'single' },
      ],
      activeFilters: [],
      analysisSettings: {
        showCellN: false,
        showColumnBases: false,
        comparisonMethod: 'cell_vs_rest',
        correctionType: 'none',
        showConfidenceIntervals: false,
        significanceLevel: 0.95,
        engine: 'auto',
      },
      dataset: {
        id: 'ds1',
        name: 'brand-tracker.sav',
        rowCount: 1200,
        variables: [
          {
            id: 'v-g',
            name: 'Q5_gender',
            label: 'Gender',
            type: 'categorical',
            valueLabels: [
              { value: 1, label: 'Male' },
              { value: 2, label: 'Female' },
            ],
            missingValues: {},
          },
          {
            id: 'v-r',
            name: 'SEG',
            label: 'Segment',
            type: 'categorical',
            valueLabels: [{ value: 1, label: 'North' }],
            missingValues: {},
          },
        ],
        source: 'sav',
      },
      commandPaletteOpen: false,
      opfsAvailable: true,
      persistenceMode: 'opfs',
      persistenceError: null,
      focusMode: false,
      isQuerying: false,
    });
  });

  it('renders StoryRail instead of the legacy sidebar and timeline dock', () => {
    render(<DashboardShell {...shellProps} />);

    expect(screen.getByTestId('story-rail')).toBeInTheDocument();
    expect(screen.getByTestId('story-rail-slide-1')).toBeInTheDocument();
    expect(screen.getByTestId('story-rail-slide-2')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search variables/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/drag variables to rows/i)).not.toBeInTheDocument();
  });

  it('navigates slides from the story rail', () => {
    render(<DashboardShell {...shellProps} />);

    fireEvent.click(screen.getByTestId('story-rail-slide-2'));
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-2');
  });

  it('toggles RecipeInspector from the toolbar (collapsed by default)', () => {
    render(<DashboardShell {...shellProps} />);

    const workspace = screen.getByTestId('dashboard-workspace');
    const inspector = screen.getByTestId('recipe-inspector');
    const recipePanel = workspace.querySelector('[data-recipe-expanded]');
    expect(recipePanel).toHaveAttribute('data-recipe-expanded', 'false');
    expect(inspector).toHaveAttribute('data-open', 'false');

    const toggle = screen.getByTestId('recipe-inspector-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(recipePanel).toHaveAttribute('data-recipe-expanded', 'true');
    expect(inspector).toHaveAttribute('data-open', 'true');
    expect(screen.getByText(/Recipe — Slide 1/)).toBeInTheDocument();
    expect(within(inspector).getByText('Q5_gender')).toBeInTheDocument();
    expect(within(inspector).getByText('SEG')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(recipePanel).toHaveAttribute('data-recipe-expanded', 'false');
    expect(inspector).toHaveAttribute('data-open', 'false');
  });

  it('opens RecipeInspector in chart view', () => {
    const slide = createSlide({
      id: 'slide-1',
      title: 'Awareness by segment',
      visualizationType: 'chart',
      cells: [{ id: 'cell-1', content: { type: 'chart', chartType: 'grouped-bar' } }],
    });
    useVelocityStore.setState({
      slides: [slide],
      activeSlideId: 'slide-1',
      activeCellId: slide.cells[0].id,
      queryResult: [
        { rowKeys: ['1'], colKey: 'north', count: 10 },
        { rowKeys: ['2'], colKey: 'north', count: 12 },
      ],
    });

    render(<DashboardShell {...shellProps} />);

    fireEvent.click(screen.getByLabelText('Chart view'));
    fireEvent.click(screen.getByTestId('recipe-inspector-toggle'));

    const workspace = screen.getByTestId('dashboard-workspace');
    expect(workspace.querySelector('[data-recipe-expanded]')).toHaveAttribute('data-recipe-expanded', 'true');
    expect(screen.getByTestId('recipe-inspector')).toHaveAttribute('data-open', 'true');
    expect(screen.getByText(/Recipe — Slide 1/)).toBeVisible();
  });

  it('mounts CommandPalette inside the dashboard DndContext for drag-out insertion', () => {
    render(<DashboardShell {...shellProps} />);

    act(() => {
      useVelocityStore.getState().openCommandPalette();
    });
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    expect(screen.getByTestId('palette-variable-gender')).toBeInTheDocument();
  });

  it('auto-opens insert palette on first upload handoff (DESIGN-CONV-H)', async () => {
    useVelocityStore.setState({
      canvasHandoffTrigger: 'fresh_upload',
      hasSeenCanvasHandoff: false,
      tableConfig: { rowVars: [], colVar: null },
      dataset: {
        id: 'ds-handoff',
        name: 'client.sav',
        rowCount: 800,
        variables: [
          {
            id: 'v-g',
            name: 'Q5_gender',
            label: 'Gender',
            type: 'categorical',
            valueLabels: [],
            missingValues: {},
          },
          {
            id: 'v-r',
            name: 'SEG',
            label: 'Segment',
            type: 'categorical',
            valueLabels: [],
            missingValues: {},
          },
        ],
        source: 'sav',
      },
      commandPaletteOpen: false,
    });

    render(<DashboardShell {...shellProps} />);

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-1');
    expect(useVelocityStore.getState().hasSeenCanvasHandoff).toBe(true);
    expect(useVelocityStore.getState().canvasHandoffTrigger).toBeNull();

    const search = await screen.findByPlaceholderText('Find a variable…');
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(search).toHaveFocus();
  });

  it('lands on slide 1 without auto-opening palette when dataset exceeds size gate', () => {
    useVelocityStore.setState({
      canvasHandoffTrigger: 'fresh_upload',
      hasSeenCanvasHandoff: false,
      activeSlideId: 'slide-2',
      tableConfig: { rowVars: [], colVar: null },
      dataset: {
        id: 'ds-large',
        name: 'large.sav',
        rowCount: 50_000,
        variables: Array.from({ length: 30 }, (_, index) => ({
          id: `v-${index}`,
          name: `q${index}`,
          label: `Q${index}`,
          type: 'categorical' as const,
          valueLabels: [],
          missingValues: {},
        })),
        source: 'sav',
      },
      commandPaletteOpen: false,
    });

    render(<DashboardShell {...shellProps} />);

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-1');
    expect(useVelocityStore.getState().hasSeenCanvasHandoff).toBe(true);
  });
});
