import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoryRail } from './StoryRail';
import { useVelocityStore } from '../../../store';
import type { Slide } from '../../../types/slides';
import type { PersistenceManagerState } from '../../../hooks/usePersistenceManager';
import type { SessionImportRailSummary } from '../../../core/session/sessionImportRailSummary';

const noop = () => {};
const noopAsync = async () => {};

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
  opfsUsageMb: 0.9,
  opfsQuotaMb: 100,
  opfsUsagePct: 1,
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

const railProps = {
  persistence: mockPersistence,
  opfsAvailable: true,
  persistenceMode: 'opfs',
  persistenceError: null,
};

describe('StoryRail', () => {
  beforeEach(() => {
    const slide1 = createSlide({
      id: 'slide-1',
      title: 'Awareness by segment',
      analysisState: { rowVars: ['gender'], colVar: 'region', filters: [], weightVar: null },
    });
    const slide2 = createSlide({ id: 'slide-2', title: 'Second slide' });
    useVelocityStore.setState({
      slides: [slide1, slide2],
      activeSlideId: 'slide-1',
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      activeFilters: [],
      variableSets: [
        { id: 'gender', name: 'Q5_gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'SEG', variableIds: ['v-r'], type: 'categorical', structure: 'single' },
      ],
      dataset: { id: 'ds1', name: 'brand-tracker.sav', rowCount: 1200, variables: [], source: 'sav' },
    });
  });

  it('renders deck outline with slide rows and persistence footer', () => {
    render(<StoryRail {...railProps} />);
    expect(screen.getByTestId('story-rail')).toBeInTheDocument();
    expect(screen.getByTestId('story-rail-slide-1')).toBeInTheDocument();
    expect(screen.getByTestId('story-rail-slide-2')).toBeInTheDocument();
    expect(screen.getByText('brand-tracker')).toBeInTheDocument();
    expect(screen.getByText('+ New slide')).toBeInTheDocument();
  });

  it('selects slides and adds a new slide from the rail', () => {
    render(<StoryRail {...railProps} />);
    fireEvent.click(screen.getByTestId('story-rail-slide-2'));
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-2');

    fireEvent.click(screen.getByText('+ New slide'));
    expect(useVelocityStore.getState().slides).toHaveLength(3);
  });

  it('duplicates the active slide via row context menu', () => {
    render(<StoryRail {...railProps} />);
    fireEvent.contextMenu(screen.getByTestId('story-rail-slide-1'));
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(useVelocityStore.getState().slides).toHaveLength(3);
  });

  it('responds to keyboard shortcut for new slide', () => {
    render(<StoryRail {...railProps} />);
    fireEvent.keyDown(document, { key: 'n' });
    expect(useVelocityStore.getState().slides).toHaveLength(3);
  });

  it('navigates slides with j/k shortcuts', () => {
    render(<StoryRail {...railProps} />);
    fireEvent.keyDown(document, { key: 'j' });
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-2');
    fireEvent.keyDown(document, { key: 'k' });
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-1');
  });

  it('confirms slide deletion from the row context menu', () => {
    render(<StoryRail {...railProps} />);
    fireEvent.contextMenu(screen.getByTestId('story-rail-slide-2'));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useVelocityStore.getState().slides).toHaveLength(1);
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-1');
  });

  it('confirms slide deletion from the hover delete control', () => {
    render(<StoryRail {...railProps} />);
    fireEvent.click(screen.getByTestId('story-rail-delete-slide-2'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useVelocityStore.getState().slides).toHaveLength(1);
    expect(useVelocityStore.getState().activeSlideId).toBe('slide-1');
  });

  it('hides hover delete when only one slide remains', () => {
    useVelocityStore.setState({ slides: [createSlide({ id: 'slide-1', title: 'Only slide' })] });
    render(<StoryRail {...railProps} />);
    expect(screen.queryByTestId('story-rail-delete-slide-1')).not.toBeInTheDocument();
  });

  it('renames a slide on double-click', () => {
    render(<StoryRail {...railProps} />);
    fireEvent.doubleClick(screen.getByTestId('story-rail-slide-1'));
    const input = screen.getByLabelText('Rename slide');
    fireEvent.change(input, { target: { value: 'Renamed slide' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useVelocityStore.getState().slides[0].title).toBe('Renamed slide');
  });
  describe('session import summary (DESIGN-CONV-I)', () => {
    const summary: SessionImportRailSummary = {
      slideCount: 3,
      hasAdjustments: true,
      unresolvedVariableLabels: ['Brand', 'Weight'],
      affectedSlideNumbers: [2],
      adjustmentMessages: [{ id: 'dropped-filter-ids', message: '1 filter was removed.' }],
    };
    it('renders a persistent session import summary in the rail footer', () => {
      render(<StoryRail {...railProps} sessionImportSummary={summary} onDismissSessionImportSummary={noop} />);
      expect(screen.getByTestId('session-import-summary')).toBeInTheDocument();
      expect(screen.getByText(/Session imported · 3 slides/)).toBeInTheDocument();
      expect(screen.getByTestId('session-import-unresolved')).toHaveTextContent('2 variables unresolved');
      expect(screen.getByTestId('session-import-affected')).toHaveTextContent('Affects slides 2');
      expect(screen.getByText('1 filter was removed.')).toBeInTheDocument();
    });
    it('dismisses the session import summary from the rail footer', () => {
      const onDismiss = vi.fn();
      const { rerender } = render(
        <StoryRail {...railProps} sessionImportSummary={summary} onDismissSessionImportSummary={onDismiss} />,
      );
      fireEvent.click(screen.getByTestId('session-import-summary-dismiss'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      rerender(<StoryRail {...railProps} sessionImportSummary={null} onDismissSessionImportSummary={onDismiss} />);
      expect(screen.queryByTestId('session-import-summary')).not.toBeInTheDocument();
    });
  });
});
