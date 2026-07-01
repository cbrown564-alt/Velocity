import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariableColumn } from './VariableColumn';
import { useVelocityStore } from '../../store';
import { makeVariable } from '../../test/fixtures/variables';

vi.mock('../../hooks/useLazyObserver', () => ({
  useLazyObserver: vi.fn(),
}));

function setupStore(overrides: Record<string, unknown> = {}) {
  const setSelectedVariableId = vi.fn();
  const getVariableStats = vi.fn().mockResolvedValue(undefined);

  useVelocityStore.setState({
    dataset: {
      id: 'ds-1',
      name: 'test.sav',
      rowCount: 100,
      variables: [
        makeVariable({ id: 'v1', name: 'gender', label: 'Gender', type: 'categorical' }),
        makeVariable({ id: 'v2', name: 'region', label: 'Region', type: 'categorical' }),
        makeVariable({ id: 'v3', name: 'age', label: 'Age', type: 'numeric' }),
      ],
      source: 'sav',
    },
    variableSets: [
      {
        id: 'vs-grid',
        name: 'Satisfaction Grid',
        variableIds: ['v1', 'v2', 'v3'],
        type: 'categorical',
        structure: 'grid',
      },
    ],
    selectedVariableSetId: 'vs-grid',
    selectedVariableId: null,
    variableStats: {},
    setSelectedVariableId,
    getVariableStats,
    ...overrides,
  });

  return { setSelectedVariableId, getVariableStats };
}

describe('VariableColumn', () => {
  beforeEach(() => {
    setupStore();
  });

  it('renders empty div when no set is selected', () => {
    useVelocityStore.setState({ selectedVariableSetId: null });
    const { container } = render(<VariableColumn />);
    // Should render a single div with no visible content (hidden column)
    expect(container.firstChild).toBeTruthy();
    expect(screen.queryByText('Variables')).not.toBeInTheDocument();
  });

  it('renders empty div for single-variable sets', () => {
    useVelocityStore.setState({
      variableSets: [
        { id: 'vs-single', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
      ],
      selectedVariableSetId: 'vs-single',
    });
    const { container } = render(<VariableColumn />);
    expect(container.firstChild).toBeTruthy();
    expect(screen.queryByText('Variables')).not.toBeInTheDocument();
  });

  it('renders variable names for a multi-variable set', () => {
    render(<VariableColumn />);
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('calls setSelectedVariableId when a variable is clicked', () => {
    const { setSelectedVariableId } = setupStore();
    render(<VariableColumn />);
    fireEvent.click(screen.getByText('Gender'));
    expect(setSelectedVariableId).toHaveBeenCalledWith('v1');
  });

  it('calls getVariableStats on hover when stats not yet loaded', () => {
    const { getVariableStats } = setupStore();
    render(<VariableColumn />);
    // Find the Gender item container and trigger mouseEnter on it
    const genderLabel = screen.getByText('Gender');
    const itemDiv = genderLabel.closest('div[class]');
    if (itemDiv) fireEvent.mouseEnter(itemDiv);
    expect(getVariableStats).toHaveBeenCalledWith('v1');
  });

  it('renders variable count in column header', () => {
    render(<VariableColumn />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
