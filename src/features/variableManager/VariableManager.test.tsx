import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VariableManager } from './VariableManager';
import { useVelocityStore } from '../../store';

vi.mock('react-window', () => ({
  List: ({ rowCount, rowComponent: RowComponent, rowProps, rowHeight }: any) => (
    <div>
      {Array.from({ length: rowCount }, (_, index) => (
        <div key={index} style={{ height: rowHeight }}>
          <RowComponent index={index} style={{}} {...rowProps} />
        </div>
      ))}
    </div>
  ),
  useListRef: () => ({ current: { scrollToRow: vi.fn() } }),
}));

describe('VariableManager', () => {
  beforeEach(() => {
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      dataset: {
        id: 'ds1',
        name: 'demo.sav',
        rowCount: 100,
        variables: [
          {
            id: 'v1',
            name: 'd2_gender',
            label: 'D2. Gender',
            type: 'categorical',
            valueLabels: [],
            missingValues: {},
          },
          {
            id: 'v2',
            name: 'd1_age',
            label: 'D1. Age',
            type: 'numeric',
            valueLabels: [],
            missingValues: {},
          },
        ],
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
      setFacetFilters: vi.fn(),
      setActiveFolderId: vi.fn(),
      moveToFolder: vi.fn(),
      setSelectedVariableSetId: vi.fn(),
      setSelectedVariableId: vi.fn(),
      selectSingleVariableSet: vi.fn(),
      getVariableStats: vi.fn().mockResolvedValue(undefined),
      setHoveredVariableSetId: vi.fn(),
      convertMultipleToGrid: vi.fn(),
    });
  });

  it('renders two-pane shell with dense variable rows', () => {
    render(<VariableManager onClose={vi.fn()} />);
    expect(screen.getByTestId('variable-manager')).toBeInTheDocument();
    expect(screen.getByText('d2_gender')).toBeInTheDocument();
    expect(screen.getByText('D2. Gender')).toBeInTheDocument();
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.queryByText('Variable Sets')).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/filter variables/i), {
      target: { value: 'gender' },
    });
    expect(setManagerSearchQuery).toHaveBeenCalledWith('gender');
  });

  it('renders type filter chips with counts', () => {
    render(<VariableManager onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /all 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /category 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /numeric 1/i })).toBeInTheDocument();
  });

  it('always shows inspector pane', () => {
    render(<VariableManager onClose={vi.fn()} />);
    expect(screen.getByTestId('variable-inspector-empty')).toBeInTheDocument();
  });

  it('uses 32px row height for density', async () => {
    const { ROW_HEIGHT } = await import('./VariableList');
    expect(ROW_HEIGHT).toBe(32);
  });
});
