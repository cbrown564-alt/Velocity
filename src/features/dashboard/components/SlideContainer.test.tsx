import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SlideContainer } from './SlideContainer';
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

const genderVariable = {
  id: 'v-g',
  name: 'gender',
  label: 'Gender',
  type: 'categorical' as const,
  valueLabels: [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
  ],
  missingValues: {},
};

const regionVariable = {
  id: 'v-r',
  name: 'region',
  label: 'Region',
  type: 'categorical' as const,
  valueLabels: [{ value: 1, label: 'North' }],
  missingValues: {},
};

function createProcessedCrosstab() {
  return {
    rows: [
      {
        key: '1',
        label: 'Male',
        rawValue: '1',
        depth: 0,
        cells: { '1': { count: 10, percent: 50 } },
        total: 10,
        children: [],
        rowPath: [{ variable: 'gender', value: '1' }],
      },
      {
        key: '2',
        label: 'Female',
        rawValue: '2',
        depth: 0,
        cells: { '1': { count: 12, percent: 60 } },
        total: 12,
        children: [],
        rowPath: [{ variable: 'gender', value: '2' }],
      },
    ],
    series: [],
    columns: [{ key: '1', label: 'North', total: 22 }],
    grandTotal: 22,
    isMetric: false,
    isGrid: false,
    rowVariables: [genderVariable],
    colVariable: regionVariable,
    isMultipleResponse: false,
  };
}

describe('SlideContainer', () => {
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

  it('shows inline error when query fails', () => {
    useVelocityStore.setState({
      tableConfig: { rowVars: ['gender'], colVar: null },
      queryError: 'Table main does not exist',
      isQuerying: false,
      variableSets: [{ id: 'gender', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' }],
      dataset: {
        id: 'ds1',
        name: 'test',
        rowCount: 100,
        variables: [
          { id: 'v1', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} },
        ],
        source: 'csv',
      },
    });

    render(<SlideContainer />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't run analysis");
    expect(screen.getByText('Table main does not exist')).toBeInTheDocument();
  });

  it('announces loading state to assistive tech while querying', () => {
    useVelocityStore.setState({ isQuerying: true });
    const { container } = render(<SlideContainer />);

    const analysisRegion = container.firstElementChild as HTMLElement;
    expect(analysisRegion).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Updating analysis results');
  });

  it('uses theme token classes on flex-filling canvas container', () => {
    const { container } = render(<SlideContainer />);
    const canvas = container.querySelector('.surface-panel') as HTMLDivElement | null;
    const header = container.querySelector('.slide-header') as HTMLDivElement | null;

    expect(canvas).toBeInTheDocument();
    expect(canvas?.className).toContain('flex-1');
    expect(canvas?.className).toContain('min-h-0');
    expect(canvas?.className).toContain('max-w-[min(100%,1400px)]');
    expect(canvas?.className).toContain('surface-panel');
    expect(canvas?.className).not.toContain('bg-white');
    expect(header?.parentElement?.className).toContain('flex-shrink-0');
    expect(container.querySelector('[data-testid="slide-content-region"]')).toBeInTheDocument();
  });

  it('shrink-wraps slide panel when analysis output is present', () => {
    useVelocityStore.setState({
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      queryResult: [
        { rowKeys: ['1'], colKey: '1', count: 10 },
        { rowKeys: ['2'], colKey: '1', count: 12 },
      ],
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'Region', variableIds: ['v-r'], type: 'categorical', structure: 'single' },
      ],
      dataset: {
        id: 'ds1',
        name: 'test',
        rowCount: 100,
        variables: [genderVariable, regionVariable],
        source: 'csv',
      },
      processedQueryResult: createProcessedCrosstab(),
    });

    const { container } = render(<SlideContainer />);
    const canvas = container.querySelector('.surface-panel') as HTMLDivElement;
    const content = container.querySelector('[data-testid="slide-content-region"]') as HTMLDivElement;

    expect(canvas.className).toContain('flex-none');
    expect(canvas.className).toContain('self-start');
    expect(content.className).toContain('flex-none');
    expect(container.querySelector('.analysis-frame')?.className).toMatch(/shrinkWrap/);
  });

  it('shrink-wraps slide panel in focus mode while keeping bleed on output frame', () => {
    useVelocityStore.setState({
      focusMode: true,
      tableConfig: { rowVars: ['gender'], colVar: null },
      queryResult: [{ rowKeys: ['1'], colKey: 'Total', count: 10 }],
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
      ],
      dataset: {
        id: 'ds1',
        name: 'test',
        rowCount: 100,
        variables: [genderVariable],
        source: 'csv',
      },
      processedQueryResult: {
        rows: [
          {
            key: '1',
            label: 'Male',
            rawValue: '1',
            depth: 0,
            cells: { Total: { count: 10, percent: 100 } },
            total: 10,
            children: [],
            rowPath: [{ variable: 'gender', value: '1' }],
          },
        ],
        series: [],
        columns: [{ key: 'Total', label: 'Total', total: 10 }],
        grandTotal: 10,
        isMetric: false,
        isGrid: false,
        rowVariables: [genderVariable],
        colVariable: null,
        isMultipleResponse: false,
      },
    });

    const { container } = render(<SlideContainer />);
    const canvas = container.querySelector('.surface-panel') as HTMLDivElement;
    const frame = container.querySelector('.analysis-frame');

    expect(canvas.className).toContain('flex-none');
    expect(canvas.className).toContain('self-start');
    expect(frame).toHaveAttribute('data-bleed', 'true');
    expect(frame?.className).toMatch(/shrinkWrap/);
  });

  it('auto-populates gender × region on mock_data.csv when deck is empty', async () => {
    useVelocityStore.setState({
      hasSeenAutoCrosstab: false,
      tableConfig: { rowVars: [], colVar: null },
      variableSets: [
        { id: 'id', name: 'id', variableIds: ['v-id'], type: 'categorical', structure: 'single' },
        { id: 'gender', name: 'gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'region', variableIds: ['v-r'], type: 'categorical', structure: 'single' },
        { id: 'sat', name: 'product sat', variableIds: ['v-s'], type: 'numeric', structure: 'single' },
      ],
      dataset: {
        id: 'mock',
        name: 'mock_data.csv',
        rowCount: 250,
        variables: [],
        source: 'csv',
      },
    });

    render(<SlideContainer />);

    await waitFor(() => {
      expect(useVelocityStore.getState().tableConfig).toEqual({
        rowVars: ['gender'],
        colVar: 'region',
      });
    });
    expect(useVelocityStore.getState().hasSeenAutoCrosstab).toBe(true);
  });
});
