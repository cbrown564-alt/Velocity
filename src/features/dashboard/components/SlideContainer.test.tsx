import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
                variables: [{ id: 'v1', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} }],
                source: 'csv',
            },
        });

        render(<SlideContainer />);
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't run analysis");
        expect(screen.getByText('Table main does not exist')).toBeInTheDocument();
    });

    it('uses theme token background classes for the 16:9 canvas', () => {
        const { container } = render(<SlideContainer />);
        const canvas = container.querySelector('div[style*="aspect-ratio"]') as HTMLDivElement | null;

        expect(canvas).toBeInTheDocument();
        expect(canvas?.className).toContain('bg-[var(--mat-panel-bg,var(--bg-panel))]');
        expect(canvas?.className).not.toContain('bg-white');
    });

});
