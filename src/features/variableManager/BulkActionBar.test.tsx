import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkActionBar } from './BulkActionBar';
import { useVelocityStore } from '../../store';

function setupStore() {
  const createFolder = vi.fn().mockReturnValue('folder-new');
  const moveToFolder = vi.fn();
  const bulkSetType = vi.fn();
  const bulkHide = vi.fn();

  useVelocityStore.setState({
    createFolder,
    moveToFolder,
    bulkSetType,
    bulkHide,
    variableSets: [
      { id: 'var-1', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
      { id: 'var-2', name: 'Region', variableIds: ['v2'], type: 'categorical', structure: 'single' },
    ],
  });

  return { createFolder, moveToFolder, bulkSetType, bulkHide };
}

describe('BulkActionBar', () => {
  beforeEach(() => {
    setupStore();
  });

  it('renders nothing when fewer than 2 items selected', () => {
    const { container } = render(
      <BulkActionBar selectedCount={1} selectedIds={['var-1']} onClearSelection={vi.fn()} />,
    );
    // AnimatePresence won't render the bar for selectedCount < 2
    expect(screen.queryByText('selected')).not.toBeInTheDocument();
    expect(container.querySelector('button[title]')).toBeNull();
  });

  it('renders selection count when 2+ items selected', () => {
    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('selected')).toBeInTheDocument();
  });

  it('opens folder name modal when Group is clicked', () => {
    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={vi.fn()} />);

    fireEvent.click(screen.getByText('Group'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create Folder')).toBeInTheDocument();
  });

  it('creates folder and moves selected items when folder name is submitted', async () => {
    const { createFolder, moveToFolder } = setupStore();
    const onClearSelection = vi.fn();

    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={onClearSelection} />);

    fireEvent.click(screen.getByText('Group'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Demographics' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith('Demographics');
      expect(moveToFolder).toHaveBeenCalledWith(['var-1', 'var-2'], 'folder-new');
      expect(onClearSelection).toHaveBeenCalled();
    });
  });

  it('shows type menu when Type button is clicked', () => {
    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={vi.fn()} />);

    fireEvent.click(screen.getByText('Type'));
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Numeric')).toBeInTheDocument();
  });

  it('calls bulkSetType when a type is selected', () => {
    const { bulkSetType } = setupStore();
    const onClearSelection = vi.fn();

    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={onClearSelection} />);

    fireEvent.click(screen.getByText('Type'));
    fireEvent.click(screen.getByText('Category'));

    expect(bulkSetType).toHaveBeenCalledWith(['var-1', 'var-2'], 'categorical');
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('calls bulkHide to hide selected items', () => {
    const { bulkHide } = setupStore();
    const onClearSelection = vi.fn();

    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={onClearSelection} />);

    fireEvent.click(screen.getByText('Hide'));
    expect(bulkHide).toHaveBeenCalledWith(['var-1', 'var-2'], true);
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('shows Show when any selected items are hidden', () => {
    useVelocityStore.setState({
      variableSets: [
        { id: 'var-1', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single', hidden: true },
        { id: 'var-2', name: 'Region', variableIds: ['v2'], type: 'categorical', structure: 'single' },
      ],
    });

    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={vi.fn()} />);

    expect(screen.getByText('Show')).toBeInTheDocument();
  });

  it('calls onClearSelection when X button is clicked', () => {
    const onClearSelection = vi.fn();
    render(<BulkActionBar selectedCount={2} selectedIds={['var-1', 'var-2']} onClearSelection={onClearSelection} />);

    // The clear button is the last button in the bar (X icon)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
