import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SlideHeader } from './SlideHeader';
import { useVelocityStore } from '../../../store';
import type { Slide } from '../../../types/slides';

function createSlide(overrides: Partial<Slide>): Slide {
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

describe('SlideHeader', () => {
  beforeEach(() => {
    const slide = createSlide({ id: 'slide-1' });
    useVelocityStore.setState({
      slides: [slide],
      activeSlideId: 'slide-1',
      activeCellId: slide.cells[0].id,
      tableConfig: { rowVars: [], colVar: null },
      queryResult: [],
      variableSets: [],
      activeFilters: [],
      tableStats: null,
      queryError: null,
      isQuerying: false,
      activeVariableStats: null,
      dataset: null,
    });
  });

  it('renders the active slide title', () => {
    render(<SlideHeader />);
    expect(screen.getByText('New Slide')).toBeInTheDocument();
  });

  it('shows a narrative suggestion when data has significant findings', () => {
    useVelocityStore.setState({
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'Region', variableIds: ['v2'], type: 'categorical', structure: 'single' },
      ],
      dataset: {
        id: 'ds1',
        name: 'test',
        rowCount: 100,
        variables: [
          { id: 'v1', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [{ value: 1, label: 'Male' }, { value: 2, label: 'Female' }], missingValues: {} },
          { id: 'v2', name: 'region', label: 'Region', type: 'categorical', valueLabels: [{ value: 1, label: 'East' }, { value: 2, label: 'West' }], missingValues: {} },
        ],
        source: 'csv',
      },
      queryResult: [
        { rowKeys: ['1'], colKey: '1', count: 60, sig: 'high_95' },
        { rowKeys: ['2'], colKey: '1', count: 40 },
      ],
    });

    render(<SlideHeader />);
    expect(screen.getByTitle('Click to use suggested title')).toBeInTheDocument();
  });

  it('clicking the suggestion commits it as the title', async () => {
    useVelocityStore.setState({
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'Region', variableIds: ['v2'], type: 'categorical', structure: 'single' },
      ],
      dataset: {
        id: 'ds1',
        name: 'test',
        rowCount: 100,
        variables: [
          { id: 'v1', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [{ value: 1, label: 'Male' }, { value: 2, label: 'Female' }], missingValues: {} },
          { id: 'v2', name: 'region', label: 'Region', type: 'categorical', valueLabels: [{ value: 1, label: 'East' }, { value: 2, label: 'West' }], missingValues: {} },
        ],
        source: 'csv',
      },
      queryResult: [
        { rowKeys: ['1'], colKey: '1', count: 60, sig: 'high_95' },
        { rowKeys: ['2'], colKey: '1', count: 40 },
      ],
    });

    render(<SlideHeader />);
    const suggestion = screen.getByTitle('Click to use suggested title');
    fireEvent.click(suggestion);

    await waitFor(() => {
      const state = useVelocityStore.getState();
      const slide = state.slides.find(s => s.id === 'slide-1');
      expect(slide?.title).toContain('Male');
    });
  });

  it('does not show suggestion when slide title has been edited', () => {
    useVelocityStore.setState({
      slides: [createSlide({ id: 'slide-1', title: 'My Custom Title' })],
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
      ],
      dataset: {
        id: 'ds1',
        name: 'test',
        rowCount: 100,
        variables: [
          { id: 'v1', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} },
        ],
        source: 'csv',
      },
      queryResult: [
        { rowKeys: ['1'], colKey: '1', count: 60, sig: 'high_95' },
      ],
    });

    render(<SlideHeader />);
    expect(screen.queryByTitle('Click to use suggested title')).not.toBeInTheDocument();
  });
});
