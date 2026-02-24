import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
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
            activeVariableStats: null,
            dataset: null,
        });
    });

    it('uses theme token background classes for the 16:9 canvas', () => {
        const { container } = render(<SlideContainer />);
        const canvas = container.querySelector('div[style*="aspect-ratio"]') as HTMLDivElement | null;

        expect(canvas).toBeInTheDocument();
        expect(canvas?.className).toContain('bg-[var(--mat-panel-bg,var(--bg-panel))]');
        expect(canvas?.className).not.toContain('bg-white');
    });
});
