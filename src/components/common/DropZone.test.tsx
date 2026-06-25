/**
 * DropZone Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DropZone } from './DropZone';
import { mockNominalSet, mockOrdinalSet } from '../../test/fixtures/variables';

// Wrap component with DndContext for droppable functionality
const renderWithDnd = (ui: React.ReactElement) => {
    return render(<DndContext>{ui}</DndContext>);
};

describe('DropZone', () => {
    // ==========================================================================
    // Empty State
    // ==========================================================================

    describe('empty state', () => {
        it('renders empty state with correct label', () => {
            renderWithDnd(
                <DropZone
                    id="drop-zone-rows"
                    type="row"
                    label="Drop rows here"
                    active={false}
                    currentVariables={[]}
                    onRemove={vi.fn()}
                />
            );

            expect(screen.getByText(/drop rows here/i)).toBeInTheDocument();
        });

        it('renders plus icon in empty state', () => {
            const { container } = renderWithDnd(
                <DropZone
                    id="drop-zone-columns"
                    type="column"
                    label="Columns"
                    active={false}
                    currentVariables={[]}
                    onRemove={vi.fn()}
                />
            );

            // Plus icon should be present
            expect(container.querySelector('svg')).toBeInTheDocument();
        });

        it('applies correct sizing for row type', () => {
            const { container } = renderWithDnd(
                <DropZone
                    id="test-zone"
                    type="row"
                    label="Rows"
                    active={false}
                    currentVariables={[]}
                    onRemove={vi.fn()}
                />
            );

            const zone = container.firstChild as HTMLElement;
            expect(zone.className).toContain('w-full');
        });

        it('applies correct sizing for column type', () => {
            const { container } = renderWithDnd(
                <DropZone
                    id="test-zone"
                    type="column"
                    label="Columns"
                    active={false}
                    currentVariables={[]}
                    onRemove={vi.fn()}
                />
            );

            const zone = container.firstChild as HTMLElement;
            expect(zone.className).toContain('min-w-[200px]');
        });
    });

    // ==========================================================================
    // With Variables
    // ==========================================================================

    describe('with variables', () => {
        it('renders variable labels', () => {
            renderWithDnd(
                <DropZone
                    id="drop-zone-rows"
                    type="row"
                    label="Rows"
                    active={false}
                    currentVariables={[mockNominalSet]}
                    onRemove={vi.fn()}
                />
            );

            expect(screen.getByText('Gender')).toBeInTheDocument();
        });

        it('renders multiple variables', () => {
            renderWithDnd(
                <DropZone
                    id="drop-zone-rows"
                    type="row"
                    label="Rows"
                    active={false}
                    currentVariables={[mockNominalSet, mockOrdinalSet]}
                    onRemove={vi.fn()}
                />
            );

            expect(screen.getByText('Gender')).toBeInTheDocument();
            expect(screen.getByText('Overall Satisfaction')).toBeInTheDocument();
        });

        it('exposes an accessible name for column chip removal', () => {
            const onRemove = vi.fn();

            renderWithDnd(
                <DropZone
                    id="drop-zone-columns"
                    type="column"
                    label="Columns"
                    active={false}
                    currentVariables={[mockNominalSet]}
                    onRemove={onRemove}
                />
            );

            const removeButton = screen.getByRole('button', { name: /remove column variable gender/i });
            fireEvent.click(removeButton);
            expect(onRemove).toHaveBeenCalledWith('set_gender');
        });

        it('calls onRemove when remove button is clicked', () => {
            const onRemove = vi.fn();

            renderWithDnd(
                <DropZone
                    id="drop-zone-rows"
                    type="row"
                    label="Rows"
                    active={false}
                    currentVariables={[mockNominalSet]}
                    onRemove={onRemove}
                />
            );

            // Find and click the remove button (X)
            const removeButton = screen.getByRole('button', { name: /remove variable/i });
            fireEvent.click(removeButton);

            expect(onRemove).toHaveBeenCalledWith('set_gender');
        });
    });

    // ==========================================================================
    // Drag States
    // ==========================================================================

    describe('drag states', () => {
        it('shows active styling when active prop is true', () => {
            const { container } = renderWithDnd(
                <DropZone
                    id="test-zone"
                    type="row"
                    label="Rows"
                    active={true}
                    currentVariables={[]}
                    onRemove={vi.fn()}
                />
            );

            const zone = container.firstChild as HTMLElement;
            // Active state should apply accent border with transparent mix
            expect(zone.className).toContain('border-[color-mix(in_srgb,var(--color-accent),transparent_50%)]');
        });

        it('does not show active styling when active is false', () => {
            const { container } = renderWithDnd(
                <DropZone
                    id="test-zone"
                    type="row"
                    label="Rows"
                    active={false}
                    currentVariables={[]}
                    onRemove={vi.fn()}
                />
            );

            const zone = container.firstChild as HTMLElement;
            // Should have default border color
            expect(zone.className).toContain('border-[var(--border-color)]');
        });
    });
});
