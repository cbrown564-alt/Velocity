/**
 * DraggableVariable Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DraggableVariable, VariableCard } from './DraggableVariable';
import {
    mockNominalSet,
    mockOrdinalSet,
    mockScaleSet,
} from '../../../test/fixtures/variables';
import { VariableSet } from '../../../types';

// Wrap component with DndContext for draggable functionality
const renderWithDnd = (ui: React.ReactElement) => {
    return render(<DndContext>{ui}</DndContext>);
};

describe('VariableCard', () => {
    // ==========================================================================
    // Rendering
    // ==========================================================================

    describe('rendering', () => {
        it('displays variable name', () => {
            render(
                <VariableCard variableSet={mockNominalSet} />
            );

            expect(screen.getByText('Gender')).toBeInTheDocument();
        });

        it('displays variable type', () => {
            render(
                <VariableCard variableSet={mockNominalSet} />
            );

            expect(screen.getByText('nominal')).toBeInTheDocument();
        });

        it('displays ordinal type', () => {
            render(
                <VariableCard variableSet={mockOrdinalSet} />
            );

            expect(screen.getByText('ordinal')).toBeInTheDocument();
        });

        it('displays scale type', () => {
            render(
                <VariableCard variableSet={mockScaleSet} />
            );

            expect(screen.getByText('scale')).toBeInTheDocument();
        });
    });

    // ==========================================================================
    // Icons
    // ==========================================================================

    describe('type icons', () => {
        it('renders Hash icon for scale variables', () => {
            const { container } = render(
                <VariableCard variableSet={mockScaleSet} />
            );

            // Hash icon should be present (lucide-react)
            expect(container.querySelector('svg')).toBeInTheDocument();
        });

        it('renders Type icon for nominal variables', () => {
            const { container } = render(
                <VariableCard variableSet={mockNominalSet} />
            );

            expect(container.querySelector('svg')).toBeInTheDocument();
        });

        it('renders BarChart2 icon for ordinal variables', () => {
            const { container } = render(
                <VariableCard variableSet={mockOrdinalSet} />
            );

            expect(container.querySelector('svg')).toBeInTheDocument();
        });
    });

    // ==========================================================================
    // Interactions
    // ==========================================================================

    describe('interactions', () => {
        it('calls onClick when clicked', () => {
            const onClick = vi.fn();

            render(
                <VariableCard variableSet={mockNominalSet} onClick={onClick} />
            );

            fireEvent.click(screen.getByText('Gender'));

            expect(onClick).toHaveBeenCalledWith(mockNominalSet, expect.any(Object));
        });






    });

    // ==========================================================================
    // Styling
    // ==========================================================================

    describe('styling', () => {
        it('applies dragging styles when isDragging is true', () => {
            const { container } = render(
                <VariableCard variableSet={mockNominalSet} isDragging={true} />
            );

            const card = container.firstChild as HTMLElement;
            expect(card.className).toContain('ring-2');
            expect(card.className).toContain('grayscale');
        });

        it('applies overlay styles when isOverlay is true', () => {
            const { container } = render(
                <VariableCard variableSet={mockNominalSet} isOverlay={true} />
            );

            const card = container.firstChild as HTMLElement;
            expect(card.className).toContain('shadow-xl');
            expect(card.className).toContain('scale-105');
        });
    });
});

describe('DraggableVariable', () => {
    it('renders with DndContext', () => {
        renderWithDnd(
            <DraggableVariable variableSet={mockNominalSet} />
        );

        expect(screen.getByText('Gender')).toBeInTheDocument();
    });

    it('passes onClick to VariableCard', () => {
        const onClick = vi.fn();

        renderWithDnd(
            <DraggableVariable variableSet={mockNominalSet} onClick={onClick} />
        );

        fireEvent.click(screen.getByText('Gender'));

        expect(onClick).toHaveBeenCalledWith(mockNominalSet, expect.any(Object));
    });


});
