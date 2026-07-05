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

    render(<FilterModal isOpen onClose={vi.fn()} variables={variables} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /age group/i }));
    await screen.findByText('18-24');

    fireEvent.click(screen.getByRole('button', { name: /back to variable selection/i }));
    fireEvent.click(screen.getByRole('button', { name: /nps segment/i }));

    expect(screen.queryByText('18-24')).not.toBeInTheDocument();
    expect(screen.getByText('Loading values...')).toBeInTheDocument();
    await screen.findByText('Promoter');
  });

  it('closes the modal and resets state when X button is clicked (handleClose)', () => {
    const onClose = vi.fn();
    const variables = [makeVariable({ id: 'age', label: 'Age Group' })];
    render(<FilterModal isOpen onClose={onClose} variables={variables} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /close filter modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with the selected value when Apply Filter is clicked (handleApply)', async () => {
    const onSave = vi.fn();
    const variables = [
      makeVariable({
        id: 'gender',
        label: 'Gender',
        valueLabels: [
          { value: 1, label: 'Yes' },
          { value: 2, label: 'No' },
        ],
      }),
    ];
    render(<FilterModal isOpen onClose={vi.fn()} variables={variables} onSave={onSave} />);

    // Step 1: select variable
    fireEvent.click(screen.getByRole('button', { name: /gender/i }));

    // Step 2: wait for values to load (uses embedded valueLabels)
    await screen.findByText('Yes');

    // Step 3: select a value (handleValueToggle)
    fireEvent.click(screen.getByRole('button', { name: /^yes/i }));

    // Step 4: apply
    fireEvent.click(screen.getByText(/apply filter/i));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ variableId: 'gender', value: '1' }), false);
  });

  it('toggles value selection on/off (handleValueToggle)', async () => {
    const variables = [
      makeVariable({
        id: 'gender',
        label: 'Gender',
        valueLabels: [
          { value: 1, label: 'Yes' },
          { value: 2, label: 'No' },
        ],
      }),
    ];
    render(<FilterModal isOpen onClose={vi.fn()} variables={variables} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /gender/i }));
    await screen.findByText('Yes');

    // Select Yes
    fireEvent.click(screen.getByRole('button', { name: /^yes/i }));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();

    // Deselect Yes
    fireEvent.click(screen.getByRole('button', { name: /^yes/i }));
    expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
  });

  it('sends filter with `in` operator for multiple values', async () => {
    const onSave = vi.fn();
    const variables = [
      makeVariable({
        id: 'gender',
        label: 'Gender',
        valueLabels: [
          { value: 1, label: 'Yes' },
          { value: 2, label: 'No' },
        ],
      }),
    ];
    render(<FilterModal isOpen onClose={vi.fn()} variables={variables} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /gender/i }));
    await screen.findByText('Yes');

    fireEvent.click(screen.getByRole('button', { name: /^yes/i }));
    fireEvent.click(screen.getByRole('button', { name: /^no/i }));
    fireEvent.click(screen.getByText(/apply filter/i));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ operator: 'in' }), false);
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
    render(<FilterModal isOpen onClose={vi.fn()} variables={variables} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /age group/i }));

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    expect(screen.queryByText('No values found')).not.toBeInTheDocument();
  });

  it('filters variables by search query', () => {
    const variables = [
      makeVariable({ id: 'age', label: 'Age Group', name: 'age' }),
      makeVariable({ id: 'gender', label: 'Gender', name: 'gender' }),
    ];
    render(<FilterModal isOpen onClose={vi.fn()} variables={variables} onSave={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/search variables/i), {
      target: { value: 'gender' },
    });

    expect(screen.getByRole('button', { name: /gender/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /age group/i })).not.toBeInTheDocument();
  });

  it('passes applyToAll=true when deck-wide filter is selected', async () => {
    const onSave = vi.fn();
    const variables = [
      makeVariable({
        id: 'gender',
        label: 'Gender',
        valueLabels: [{ value: 1, label: 'Yes' }],
      }),
    ];
    render(<FilterModal isOpen onClose={vi.fn()} variables={variables} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /gender/i }));
    await screen.findByText('Yes');
    fireEvent.click(screen.getByRole('button', { name: /^yes/i }));
    fireEvent.click(screen.getByLabelText(/apply to all slides in deck/i));
    fireEvent.click(screen.getByText(/apply filter/i));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ variableId: 'gender' }), true);
  });
});
