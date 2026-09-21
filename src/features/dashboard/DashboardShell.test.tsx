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
    const recipePanel = workspace.querySelector('[data-recipe-expanded]');
    expect(recipePanel).toHaveAttribute('data-recipe-expanded', 'false');
    // DESIGN-CONV-K3: closed inspector is unmounted so controls are not focusable.
    expect(screen.queryByTestId('recipe-inspector')).not.toBeInTheDocument();

    const toggle = screen.getByTestId('recipe-inspector-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(recipePanel).toHaveAttribute('data-recipe-expanded', 'true');
    const inspector = screen.getByTestId('recipe-inspector');
    expect(inspector).toHaveAttribute('data-open', 'true');
    expect(screen.getByText(/Recipe — Slide 1/)).toBeInTheDocument();
    expect(within(inspector).getByText('Q5_gender')).toBeInTheDocument();
    expect(within(inspector).getByText('SEG')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(recipePanel).toHaveAttribute('data-recipe-expanded', 'false');
    expect(screen.queryByTestId('recipe-inspector')).not.toBeInTheDocument();
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
});
