import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TimelineDock } from './TimelineDock';
import { useVelocityStore } from '../../../store';
import type { Slide } from '../../../types/slides';

function createSlide(overrides: Partial<Slide>): Slide {
  const now = Date.now();
  return {
    id: overrides.id ?? `slide-${now}`,
    title: overrides.title ?? 'Slide',
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

describe('TimelineDock', () => {
  beforeEach(() => {
    const activeSlide = createSlide({
      id: 'slide-1',
      title: 'New Slide',
      analysisState: {
        rowVars: ['saved-var'],
        colVar: null,
        filters: [],
        weightVar: null,
      },
    });
    const secondSlide = createSlide({
      id: 'slide-2',
      title: 'New Slide',
      analysisState: {
        rowVars: ['second-var'],
        colVar: null,
        filters: [],
        weightVar: null,
      },
    });

    useVelocityStore.setState({
      slides: [activeSlide, secondSlide],
      sections: [],
      activeSlideId: 'slide-1',
      activeCellId: activeSlide.cells[0].id,
      tableConfig: { rowVars: ['live-var'], colVar: null },
      activeFilters: [],
      variableSets: [
        { id: 'saved-var', name: 'Saved Label', variableIds: ['saved-var'], structure: 'single' },
        { id: 'live-var', name: 'Live Label', variableIds: ['live-var'], structure: 'single' },
        { id: 'second-var', name: 'Second Label', variableIds: ['second-var'], structure: 'single' },
      ],
    });
  });

  it('uses live table config for the active slide thumbnail label', () => {
    render(<TimelineDock />);

    expect(screen.getByText('Live Label')).toBeInTheDocument();
    expect(screen.queryByText('Saved Label')).not.toBeInTheDocument();
  });

  it('uses saved analysis state for inactive slide thumbnail labels', () => {
    render(<TimelineDock />);

    expect(screen.getAllByText('Second Label').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /slide 2: second label/i })).toBeInTheDocument();
  });

  it('updates the active slide thumbnail label when the slide title changes', () => {
    render(<TimelineDock />);

    act(() => {
      useVelocityStore.getState().updateSlideTitle('slide-1', 'Renamed Slide');
    });

    expect(screen.getByText('Renamed Slide')).toBeInTheDocument();
    expect(screen.queryByText('Live Label')).not.toBeInTheDocument();
  });

  it('does not duplicate the slide on plain D', () => {
    render(<TimelineDock />);
    const countBefore = useVelocityStore.getState().slides.length;

    act(() => {
      fireEvent.keyDown(document, { key: 'd' });
    });

    expect(useVelocityStore.getState().slides.length).toBe(countBefore);
  });

  it('duplicates the active slide on Ctrl+D', () => {
    render(<TimelineDock />);
    const countBefore = useVelocityStore.getState().slides.length;

    act(() => {
      fireEvent.keyDown(document, { key: 'd', ctrlKey: true });
    });

    expect(useVelocityStore.getState().slides.length).toBe(countBefore + 1);
  });

  it('does not add a slide on N while Variable Manager is open', () => {
    useVelocityStore.setState({ appMode: 'variables' });
    render(<TimelineDock />);
    const countBefore = useVelocityStore.getState().slides.length;

    act(() => {
      fireEvent.keyDown(document, { key: 'n' });
    });

    expect(useVelocityStore.getState().slides.length).toBe(countBefore);
  });

  it('adds a slide on N when canvas is active', () => {
    useVelocityStore.setState({ appMode: 'analysis' });
    render(<TimelineDock />);
    const countBefore = useVelocityStore.getState().slides.length;

    act(() => {
      fireEvent.keyDown(document, { key: 'n' });
    });

    expect(useVelocityStore.getState().slides.length).toBe(countBefore + 1);
  });

  it('navigates to the next slide with ArrowRight', () => {
    useVelocityStore.setState({ appMode: 'analysis', activeSlideId: 'slide-1' });
    render(<TimelineDock />);

    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowRight' });
    });

    expect(useVelocityStore.getState().activeSlideId).toBe('slide-2');
  });

  it('opens delete confirmation when Delete is pressed with multiple slides', () => {
    useVelocityStore.setState({ appMode: 'analysis', activeSlideId: 'slide-1' });
    render(<TimelineDock />);

    act(() => {
      fireEvent.keyDown(document, { key: 'Delete' });
    });

    expect(screen.getByText(/delete slide/i)).toBeInTheDocument();
  });
});
