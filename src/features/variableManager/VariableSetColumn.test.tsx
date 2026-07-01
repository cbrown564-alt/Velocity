import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { VariableSetColumn } from './VariableSetColumn';
import { useVelocityStore } from '../../store';

// Mock react-window List to render all rows (not virtualized)
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
  useListRef: () => ({ current: null }),
}));

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

const makeVariableSet = (id: string, overrides = {}) => ({
  id,
  name: id,
  variableIds: [id],
  structure: 'single' as const,
  type: 'categorical' as const,
  hidden: false,
  ...overrides,
});

const makeVariable = (id: string, overrides = {}) => ({
  id,
  name: id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
  type: 'categorical' as const,
  valueLabels: [],
  missingValues: {},
  ...overrides,
});

const setupStore = (overrides = {}) =>
  useVelocityStore.setState({
    dataset: {
      id: 'd1',
      name: 'Test Dataset',
      rowCount: 100,
      source: 'csv',
      variables: [makeVariable('gender'), makeVariable('age')],
    },
    variableSets: [makeVariableSet('gender'), makeVariableSet('age')],
    activeFolderId: null,
    managerSearchQuery: '',
    selectedVariableSetId: null,
    selectedVariableSetIds: [],
    setSelectedVariableSetId: vi.fn(),
    setSelectedVariableId: vi.fn(),
    toggleVariableSetSelection: vi.fn(),
    selectVariableSetRange: vi.fn(),
    selectSingleVariableSet: vi.fn(),
    getVariableStats: vi.fn().mockResolvedValue(null),
    variableStats: {},
    setActiveFolderId: vi.fn(),
    facetFilters: { types: [], statuses: [], qualities: [] },
    convertMultipleToGrid: vi.fn(),
    hoveredVariableSetId: null,
    setHoveredVariableSetId: vi.fn(),
    transformLog: [],
    ...overrides,
  } as never);

describe('VariableSetColumn', () => {
  beforeEach(setupStore);

  it('shows empty state when no dataset is loaded', () => {
    useVelocityStore.setState({ dataset: null } as never);
    renderWithDnd(<VariableSetColumn />);
    expect(screen.getByText('No data loaded')).toBeInTheDocument();
  });

  it('renders variable set names when dataset is loaded', () => {
    renderWithDnd(<VariableSetColumn />);
    expect(screen.getByText('gender')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('shows variable set count in column header', () => {
    renderWithDnd(<VariableSetColumn />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls setSelectedVariableSetId and selectSingleVariableSet when variable set is clicked', () => {
    const setSelectedVariableSetId = vi.fn();
    const selectSingleVariableSet = vi.fn();
    const setSelectedVariableId = vi.fn();
    useVelocityStore.setState({ setSelectedVariableSetId, selectSingleVariableSet, setSelectedVariableId } as never);

    renderWithDnd(<VariableSetColumn />);
    fireEvent.click(screen.getByText('gender'));
    expect(setSelectedVariableSetId).toHaveBeenCalledWith('gender');
    expect(selectSingleVariableSet).toHaveBeenCalledWith('gender');
    expect(setSelectedVariableId).toHaveBeenCalledWith('gender');
  });

  it('calls setHoveredVariableSetId to null when mouse leaves column', () => {
    const setHoveredVariableSetId = vi.fn();
    useVelocityStore.setState({ setHoveredVariableSetId } as never);

    const { container } = renderWithDnd(<VariableSetColumn />);
    // The outer column div has onMouseLeave
    const colDiv = container.firstChild as HTMLElement;
    fireEvent.mouseLeave(colDiv);
    expect(setHoveredVariableSetId).toHaveBeenCalledWith(null);
  });

  it('renders multi-variable set with structure label', () => {
    useVelocityStore.setState({
      variableSets: [
        makeVariableSet('multi-q', {
          variableIds: ['q1', 'q2', 'q3'],
          structure: 'multiple',
        }),
      ],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 100,
        source: 'csv',
        variables: [makeVariable('q1'), makeVariable('q2'), makeVariable('q3')],
      },
    } as never);

    renderWithDnd(<VariableSetColumn />);
    // getStructureLabel('multiple', 3) => 'Multi (3)'
    expect(screen.getByText('Multi (3)')).toBeInTheDocument();
  });

  it('renders label quality dot for variable with value labels', () => {
    useVelocityStore.setState({
      variableSets: [makeVariableSet('gender')],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 100,
        source: 'csv',
        variables: [
          makeVariable('gender', {
            valueLabels: [
              { value: 1, label: 'Male' },
              { value: 2, label: 'Female' },
            ],
          }),
        ],
      },
    } as never);

    const { container } = renderWithDnd(<VariableSetColumn />);
    // getLabelQuality returns 'full' when all values labeled
    const qualityDot = container.querySelector('[data-quality]');
    expect(qualityDot).not.toBeNull();
  });

  it('shows empty state message when no variable sets match search', () => {
    useVelocityStore.setState({ managerSearchQuery: 'xxxxnonexistent' } as never);
    renderWithDnd(<VariableSetColumn />);
    expect(screen.getByText(/no matching variables/i)).toBeInTheDocument();
  });
});
