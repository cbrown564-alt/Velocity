import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilterModal } from './FilterModal';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../types/dataset';

function makeVariable(overrides: Partial<Variable>): Variable {
  return {
    id: overrides.id ?? 'var-1',
    name: overrides.name ?? 'var_1',
    label: overrides.label ?? 'Variable 1',
    type: overrides.type ?? 'categorical',
    valueLabels: overrides.valueLabels ?? [],
    missingValues: overrides.missingValues ?? {},
    ...overrides,
  };
}

describe('FilterModal', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      getUniqueValues: vi.fn(async () => []),
      getVariableStats: vi.fn(async () => null),
    } as never);
  });

  it('clears stale values while loading new variable options', async () => {
    const getUniqueValues = vi.fn(async (variableId: string) => {
      if (variableId === 'age') return ['18-24', '25-34'];
      return new Promise<string[]>((resolve) => {
        setTimeout(() => resolve(['Promoter', 'Passive', 'Detractor']), 10);
      });
    });
    useVelocityStore.setState({ getUniqueValues } as never);

    const variables = [
      makeVariable({ id: 'age', label: 'Age Group' }),
      makeVariable({ id: 'nps', label: 'NPS Segment' }),
    ];

    render(
      <FilterModal
        isOpen
        onClose={vi.fn()}
        variables={variables}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /age group/i }));
    await screen.findByText('18-24');

    fireEvent.click(screen.getByRole('button', { name: /back to variable selection/i }));
    fireEvent.click(screen.getByRole('button', { name: /nps segment/i }));

    expect(screen.queryByText('18-24')).not.toBeInTheDocument();
    expect(screen.getByText('Loading values...')).toBeInTheDocument();
    await screen.findByText('Promoter');
  });

  it('falls back to variable stats frequencies when unique values are empty', async () => {
    const getUniqueValues = vi.fn(async () => []);
    const getVariableStats = vi.fn(async () => ({
      frequencies: [
        { value: 1, count: 25 },
        { value: 2, count: 30 },
        { value: null, count: 5 },
      ],
    }));
    useVelocityStore.setState({ getUniqueValues, getVariableStats } as never);

    const variables = [makeVariable({ id: 'age', label: 'Age Group' })];
    render(
      <FilterModal
        isOpen
        onClose={vi.fn()}
        variables={variables}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /age group/i }));

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    expect(screen.queryByText('No values found')).not.toBeInTheDocument();
  });
});
