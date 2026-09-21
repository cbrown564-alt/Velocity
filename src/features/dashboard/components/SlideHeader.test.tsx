import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    const title = screen.getByText('New Slide');
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('slide-header-title');
  });

  it('uses display typography for the slide artifact title (DESIGN-CONV-K3)', () => {
    const css = readFileSync(resolve(__dirname, 'SlideHeader.css'), 'utf8');
    expect(css).toMatch(/\.slide-header-title\s*\{[^}]*font-family:\s*var\(--font-display\)/s);
    expect(css).toMatch(/\.slide-header-title-input\s*\{[^}]*font-family:\s*var\(--font-display\)/s);
  });

  it('shows filtered sample size in subtitle when filters are active (UXR-010)', () => {
    useVelocityStore.setState({
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      activeFilters: [{ id: 'f1', variableId: 'nps', operator: 'eq', value: 'Promoter' }],
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'Region', variableIds: ['v2'], type: 'categorical', structure: 'single' },
      ],
      dataset: {
        id: 'ds1',
        name: 'test',
        rowCount: 250,
        variables: [
          { id: 'v1', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} },
          { id: 'v2', name: 'region', label: 'Region', type: 'categorical', valueLabels: [], missingValues: {} },
          { id: 'nps', name: 'nps', label: 'NPS segment', type: 'categorical', valueLabels: [], missingValues: {} },
        ],
        source: 'csv',
      },
      queryResult: [
        { rowKeys: ['1'], colKey: 'Total', count: 25 },
        { rowKeys: ['2'], colKey: 'Total', count: 17 },
      ],
    });

    render(<SlideHeader />);
    expect(screen.getByText(/Filtered: NPS segment = Promoter/)).toBeInTheDocument();
    expect(screen.getByText(/N = 42 Respondents/)).toBeInTheDocument();
    expect(screen.queryByText(/N = 250 Respondents/)).not.toBeInTheDocument();
  });

  it('commits inline title edits on Enter', async () => {
    render(<SlideHeader />);

    fireEvent.click(screen.getByText('New Slide'));
    const input = screen.getByDisplayValue('New Slide');
    fireEvent.change(input, { target: { value: 'Quarterly Tracker' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useVelocityStore.getState().slides[0]?.title).toBe('Quarterly Tracker');
    });
  });

  it('cancels inline title edits on Escape', () => {
    render(<SlideHeader />);

    fireEvent.click(screen.getByText('New Slide'));
    const input = screen.getByDisplayValue('New Slide');
    fireEvent.change(input, { target: { value: 'Draft Title' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.getByText('New Slide')).toBeInTheDocument();
    expect(useVelocityStore.getState().slides[0]?.title).toBe('New Slide');
  });
});
