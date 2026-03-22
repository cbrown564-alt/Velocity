import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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
    });

    it('updates the active slide thumbnail label when the slide title changes', () => {
        render(<TimelineDock />);

        act(() => {
            useVelocityStore.getState().updateSlideTitle('slide-1', 'Renamed Slide');
        });

        expect(screen.getByText('Renamed Slide')).toBeInTheDocument();
        expect(screen.queryByText('Live Label')).not.toBeInTheDocument();
    });
});
