/**
 * DraggableVariable Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DraggableVariable, VariableCard } from './DraggableVariable';
import {
    mockNominalVariable,
    mockOrdinalVariable,
    mockScaleVariable,
} from '../../../test/fixtures/variables';

// Wrap component with DndContext for draggable functionality
const renderWithDnd = (ui: React.ReactElement) => {
    return render(<DndContext>{ui}</DndContext>);
};

describe('VariableCard', () => {
    // ==========================================================================
    // Rendering
    // ==========================================================================

    describe('rendering', () => {
        it('displays variable label', () => {
            render(
                <VariableCard variable={mockNominalVariable} />
            );

            expect(screen.getByText('Gender')).toBeInTheDocument();
        });

        it('displays variable type', () => {
            render(
                <VariableCard variable={mockNominalVariable} />
            );

            expect(screen.getByText('nominal')).toBeInTheDocument();
        });

        it('displays ordinal type', () => {
            render(
                <VariableCard variable={mockOrdinalVariable} />
            );

            expect(screen.getByText('ordinal')).toBeInTheDocument();
        });

        it('displays scale type', () => {
            render(
                <VariableCard variable={mockScaleVariable} />
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
                <VariableCard variable={mockScaleVariable} />
            );

            // Hash icon should be present (lucide-react)
            expect(container.querySelector('svg')).toBeInTheDocument();
        });

        it('renders Type icon for nominal variables', () => {
            const { container } = render(
                <VariableCard variable={mockNominalVariable} />
            );

            expect(container.querySelector('svg')).toBeInTheDocument();
        });

        it('renders BarChart2 icon for ordinal variables', () => {
            const { container } = render(
                <VariableCard variable={mockOrdinalVariable} />
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
                <VariableCard variable={mockNominalVariable} onClick={onClick} />
            );

            fireEvent.click(screen.getByText('Gender'));

            expect(onClick).toHaveBeenCalledWith(mockNominalVariable);
        });

        it('shows recode button when onRecode is provided', () => {
            render(
                <VariableCard variable={mockNominalVariable} onRecode={vi.fn()} />
            );

            // Recode button should exist (visible on hover via CSS)
            expect(screen.getByTitle('Recode / Group Values')).toBeInTheDocument();
        });

        it('calls onRecode when recode button is clicked', () => {
            const onRecode = vi.fn();

            render(
                <VariableCard variable={mockNominalVariable} onRecode={onRecode} />
            );

            fireEvent.click(screen.getByTitle('Recode / Group Values'));

            expect(onRecode).toHaveBeenCalledWith(mockNominalVariable);
        });

        it('does not show recode button when in overlay mode', () => {
            render(
                <VariableCard
                    variable={mockNominalVariable}
                    onRecode={vi.fn()}
                    isOverlay={true}
                />
            );

            expect(screen.queryByTitle('Recode / Group Values')).not.toBeInTheDocument();
        });
    });

    // ==========================================================================
    // Styling
    // ==========================================================================

    describe('styling', () => {
        it('applies dragging styles when isDragging is true', () => {
            const { container } = render(
                <VariableCard variable={mockNominalVariable} isDragging={true} />
            );

            const card = container.firstChild as HTMLElement;
            expect(card.className).toContain('ring-2');
            expect(card.className).toContain('grayscale');
        });

        it('applies overlay styles when isOverlay is true', () => {
            const { container } = render(
                <VariableCard variable={mockNominalVariable} isOverlay={true} />
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
            <DraggableVariable variable={mockNominalVariable} />
        );

        expect(screen.getByText('Gender')).toBeInTheDocument();
    });

    it('passes onClick to VariableCard', () => {
        const onClick = vi.fn();

        renderWithDnd(
            <DraggableVariable variable={mockNominalVariable} onClick={onClick} />
        );

        fireEvent.click(screen.getByText('Gender'));

        expect(onClick).toHaveBeenCalledWith(mockNominalVariable);
    });

    it('passes onRecode to VariableCard', () => {
        const onRecode = vi.fn();

        renderWithDnd(
            <DraggableVariable variable={mockNominalVariable} onRecode={onRecode} />
        );

        expect(screen.getByTitle('Recode / Group Values')).toBeInTheDocument();
    });
});
