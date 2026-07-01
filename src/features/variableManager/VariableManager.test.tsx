import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VariableManager } from './VariableManager';
import { useVelocityStore } from '../../store';

describe('VariableManager', () => {
  beforeEach(() => {
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      dataset: {
        id: 'ds1',
        name: 'demo.sav',
        rowCount: 100,
        variables: [],
        source: 'sav',
      },
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'Region', variableIds: ['v2'], type: 'numeric', structure: 'single' },
      ],
      folders: [],
      managerSearchQuery: '',
      selectedVariableSetIds: [],
      selectedVariableSetId: null,
      selectedVariableId: null,
      activeFolderId: null,
      facetFilters: { types: [], statuses: [], qualities: [] },
      variableStats: {},
      clearSelection: vi.fn(),
      selectAllVariableSets: vi.fn(),
      setManagerSearchQuery: vi.fn(),
      moveToFolder: vi.fn(),
    });
  });

  it('renders variable manager shell with dataset variables', () => {
    render(<VariableManager onClose={vi.fn()} />);
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<VariableManager onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close variable manager/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates manager search query from the search input', () => {
    const setManagerSearchQuery = vi.fn();
    useVelocityStore.setState({ setManagerSearchQuery });

    render(<VariableManager onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search variables/i), {
      target: { value: 'gender' },
    });

    expect(setManagerSearchQuery).toHaveBeenCalledWith('gender');
  });
});
