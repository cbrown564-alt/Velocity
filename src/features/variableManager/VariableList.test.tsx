import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { VariableList } from './VariableList';
import { useVelocityStore } from '../../store';

vi.mock('react-window', () => ({
  List: ({ rowCount, rowComponent: RowComponent, rowProps, rowHeight }: any) => (
    <div data-testid="virtual-list">
      {Array.from({ length: rowCount }, (_, index) => (
        <div key={index} style={{ height: rowHeight }}>
          <RowComponent index={index} style={{}} {...rowProps} />
        </div>
      ))}
    </div>
  ),
  useListRef: () => ({ current: { scrollToRow: vi.fn() } }),
}));

describe('VariableList', () => {
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
        ],
        source: 'sav',
      },
      variableSets: [
        { id: 'gender', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
      ],
      managerSearchQuery: '',
      selectedVariableSetIds: [],
      selectedVariableSetId: null,
      selectedVariableId: null,
      activeFolderId: null,
      facetFilters: { types: [], statuses: [], qualities: [] },
      variableStats: {},
      setSelectedVariableSetId: vi.fn(),
      setSelectedVariableId: vi.fn(),
      selectSingleVariableSet: vi.fn(),
      toggleVariableSetSelection: vi.fn(),
      selectVariableSetRange: vi.fn(),
      getVariableStats: vi.fn().mockResolvedValue(undefined),
      setHoveredVariableSetId: vi.fn(),
      convertMultipleToGrid: vi.fn(),
    });
  });

  it('renders dense rows with mono name and label', () => {
    render(<DndContext><VariableList /></DndContext>);
    expect(screen.getByText('d2_gender')).toBeInTheDocument();
    expect(screen.getByText('D2. Gender')).toBeInTheDocument();
  });
});
