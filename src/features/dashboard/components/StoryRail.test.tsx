import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoryRail } from './StoryRail';
import { useVelocityStore } from '../../../store';
import type { Slide } from '../../../types/slides';
import type { PersistenceManagerState } from '../../../hooks/usePersistenceManager';

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

  describe('collapsible rail (DESIGN-CONV-G)', () => {
    it('collapses to an icon strip when the deck has a single slide', () => {
      useVelocityStore.setState({
        slides: [createSlide({ id: 'slide-1', title: 'Only slide' })],
        activeSlideId: 'slide-1',
      });
      render(<StoryRail {...railProps} />);

      const rail = screen.getByTestId('story-rail');
      expect(rail).toHaveAttribute('data-rail-collapsed', 'true');
      expect(rail).toHaveAttribute('data-rail-expanded', 'false');
      expect(rail.style.width).toBe('44px');
      expect(screen.queryByText('brand-tracker')).not.toBeInTheDocument();
      expect(screen.queryByText('+ New slide')).not.toBeInTheDocument();
      expect(screen.getByTestId('story-rail-slide-1-compact')).toBeInTheDocument();
    });

    it('stays expanded when the deck has multiple slides', () => {
      render(<StoryRail {...railProps} />);

      const rail = screen.getByTestId('story-rail');
      expect(rail).toHaveAttribute('data-rail-collapsed', 'false');
      expect(rail).toHaveAttribute('data-rail-expanded', 'true');
      expect(rail.style.width).toBe('240px');
      expect(screen.getByText('brand-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('story-rail-slide-1')).toBeInTheDocument();
      expect(screen.queryByTestId('story-rail-slide-1-compact')).not.toBeInTheDocument();
    });

    it('expands on hover when collapsed for a single-slide session', () => {
      useVelocityStore.setState({
        slides: [createSlide({ id: 'slide-1', title: 'Only slide' })],
        activeSlideId: 'slide-1',
      });
      render(<StoryRail {...railProps} />);

      const rail = screen.getByTestId('story-rail');
      fireEvent.mouseEnter(rail);

      expect(rail).toHaveAttribute('data-rail-collapsed', 'false');
      expect(rail).toHaveAttribute('data-rail-expanded', 'true');
      expect(rail.style.width).toBe('240px');
      expect(screen.getByText('brand-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('story-rail-slide-1')).toBeInTheDocument();
    });

    it('expands when the deck grows beyond one slide', () => {
      useVelocityStore.setState({
        slides: [createSlide({ id: 'slide-1', title: 'Only slide' })],
        activeSlideId: 'slide-1',
      });
      const { rerender } = render(<StoryRail {...railProps} />);
      expect(screen.getByTestId('story-rail')).toHaveAttribute('data-rail-collapsed', 'true');

      act(() => {
        useVelocityStore.setState({
          slides: [
            createSlide({ id: 'slide-1', title: 'First slide' }),
            createSlide({ id: 'slide-2', title: 'Second slide' }),
          ],
          activeSlideId: 'slide-1',
        });
      });
      rerender(<StoryRail {...railProps} />);

      const rail = screen.getByTestId('story-rail');
      expect(rail).toHaveAttribute('data-rail-collapsed', 'false');
      expect(rail).toHaveAttribute('data-rail-expanded', 'true');
      expect(rail.style.width).toBe('240px');
    });

    it('re-collapses when the deck returns to a single slide', () => {
      const { rerender } = render(<StoryRail {...railProps} />);
      expect(screen.getByTestId('story-rail')).toHaveAttribute('data-rail-expanded', 'true');

      act(() => {
        useVelocityStore.setState({
          slides: [createSlide({ id: 'slide-1', title: 'Only slide' })],
          activeSlideId: 'slide-1',
        });
      });
      rerender(<StoryRail {...railProps} />);

      const rail = screen.getByTestId('story-rail');
      expect(rail).toHaveAttribute('data-rail-collapsed', 'true');
      expect(rail).toHaveAttribute('data-rail-expanded', 'false');
    });

    it('uses a calm width transition within the motion budget', () => {
      useVelocityStore.setState({
        slides: [createSlide({ id: 'slide-1', title: 'Only slide' })],
        activeSlideId: 'slide-1',
      });
      render(<StoryRail {...railProps} />);

      const rail = screen.getByTestId('story-rail');
      expect(rail.style.transition).toMatch(/width/);
      expect(rail.style.transition).toMatch(/150ms/);
    });
  });
});
