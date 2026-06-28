import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableRowShelf } from './SortableRowShelf';
import { VariableSet } from '../../types';
import { DndContext } from '@dnd-kit/core';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('SortableRowShelf', () => {
  const mockVariableSets: VariableSet[] = [
    {
      id: 'set1',
      name: 'Age Group',
      variableIds: ['age'],
      structure: 'single',
      type: 'ordinal',
    },
    {
      id: 'set2',
      name: 'Gender',
      variableIds: ['gender'],
      structure: 'single',
      type: 'nominal',
    },
    {
      id: 'set3',
      name: 'Income Level',
      variableIds: ['income'],
      structure: 'single',
      type: 'ordinal',
    },
  ];

  const mockOnRemove = vi.fn();

  it('should render all variable sets', () => {
    render(
      <DndContext>
        <SortableRowShelf variableSets={mockVariableSets} onRemove={mockOnRemove} />
      </DndContext>,
    );

    expect(screen.getByText('Age Group')).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Income Level')).toBeInTheDocument();
  });

  it('should render sortable items for each variable', () => {
    render(
      <DndContext>
        <SortableRowShelf variableSets={mockVariableSets} onRemove={mockOnRemove} />
      </DndContext>,
    );

    // Sortable items have role="button" and aria-roledescription="sortable"
    const sortableItems = screen.getAllByRole('button', { name: /Age Group|Gender|Income Level/ });
    expect(sortableItems).toHaveLength(3);
  });

  it('should render remove buttons for each item', () => {
    render(
      <DndContext>
        <SortableRowShelf variableSets={mockVariableSets} onRemove={mockOnRemove} />
      </DndContext>,
    );

    const removeButtons = screen.getAllByLabelText('Remove variable');
    expect(removeButtons).toHaveLength(3);
  });

  it('should call onRemove when remove button is clicked', () => {
    render(
      <DndContext>
        <SortableRowShelf variableSets={mockVariableSets} onRemove={mockOnRemove} />
      </DndContext>,
    );

    const removeButtons = screen.getAllByLabelText('Remove variable');
    removeButtons[0].click();

    expect(mockOnRemove).toHaveBeenCalledWith('set1');
  });

  it('should render empty when no variable sets provided', () => {
    const { container } = render(
      <DndContext>
        <SortableRowShelf variableSets={[]} onRemove={mockOnRemove} />
      </DndContext>,
    );

    expect(container.querySelector('.flex.flex-row.gap-2')).toBeInTheDocument();
    expect(screen.queryByText('Age Group')).not.toBeInTheDocument();
  });
});
