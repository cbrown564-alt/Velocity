import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InspectorStats } from './InspectorStats';
import { useVelocityStore } from '../../../store';

describe('InspectorStats accessibility labels', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      updateValueLabel: vi.fn(),
      toggleDiscreteMissingValue: vi.fn(),
      fillSystemMissing: vi.fn(),
    } as never);
  });

  it('uses distinct accessible names for each value-mapping action', () => {
    render(
      <InspectorStats
        variable={{
          id: 'gender',
          name: 'gender',
          label: 'Gender',
          type: 'categorical',
          valueLabels: [
            { value: 1, label: 'Male' },
            { value: 2, label: 'Female' },
          ],
          missingValues: {},
        }}
        stats={{
          totalCount: 100,
          missingCount: 0,
          frequencies: [
            { value: 1, count: 55 },
            { value: 2, count: 45 },
          ],
        } as never}
        isLoadingStats={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Set Male (1) as missing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Female (2) as missing' })).toBeInTheDocument();
  });
});
