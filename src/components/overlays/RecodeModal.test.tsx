import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecodeModal } from '../../components/overlays/RecodeModal';
import { useVelocityStore } from '../../store';

describe('RecodeModal', () => {
  it('calls onSave after a successful recode', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const recodeVariable = vi.fn().mockResolvedValue('gender_grouped');
    const getUniqueValues = vi.fn().mockResolvedValue(['1', '2']);

    useVelocityStore.setState({
      recodeVariable,
      getUniqueValues,
    } as never);

    render(
      <RecodeModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        variable={{
          id: 'gender',
          name: 'gender',
          label: 'Gender',
          type: 'categorical',
          valueLabels: [],
          missingValues: {},
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Gender (Recoded)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /create variable/i }));

    await waitFor(() => {
      expect(recodeVariable).toHaveBeenCalledWith(
        'gender',
        'Gender (Recoded)',
        expect.objectContaining({ mode: 'categorical' }),
      );
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without saving when cancel is clicked', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    useVelocityStore.setState({
      recodeVariable: vi.fn(),
      getUniqueValues: vi.fn().mockResolvedValue(['1']),
    } as never);

    render(
      <RecodeModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        variable={{
          id: 'gender',
          name: 'gender',
          label: 'Gender',
          type: 'categorical',
          valueLabels: [],
          missingValues: {},
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Gender (Recoded)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
