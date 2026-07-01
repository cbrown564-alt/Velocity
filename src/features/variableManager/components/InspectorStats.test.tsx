import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InspectorStats } from './InspectorStats';
import { useVelocityStore } from '../../../store';
import { makeVariable } from '../../../test/fixtures/variables';

function setupStore() {
  const updateValueLabel = vi.fn();
  const toggleDiscreteMissingValue = vi.fn();
  const fillSystemMissing = vi.fn().mockResolvedValue(undefined);

  useVelocityStore.setState({
    updateValueLabel,
    toggleDiscreteMissingValue,
    fillSystemMissing,
  });

  return { updateValueLabel, toggleDiscreteMissingValue, fillSystemMissing };
}

const genderVar = makeVariable({
  id: 'gender',
  name: 'gender',
  label: 'Gender',
  type: 'categorical',
  valueLabels: [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
  ],
  missingValues: { discrete: [-99] },
});

const genderStats = {
  totalCount: 100,
  missingCount: 5,
  frequencies: [
    { value: 1, count: 55 },
    { value: 2, count: 40 },
    { value: -99, count: 5 },
  ],
} as any;

describe('InspectorStats accessibility labels', () => {
  beforeEach(() => {
    setupStore();
  });

  it('uses distinct accessible names for each value-mapping action', () => {
    render(<InspectorStats variable={genderVar} stats={genderStats} isLoadingStats={false} />);

    expect(screen.getByRole('button', { name: 'Set Male (1) as missing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Female (2) as missing' })).toBeInTheDocument();
  });
});

describe('InspectorStats interactions', () => {
  beforeEach(() => {
    setupStore();
  });

  it('calls toggleDiscreteMissingValue when set-missing button is clicked', () => {
    const { toggleDiscreteMissingValue } = setupStore();

    render(<InspectorStats variable={genderVar} stats={genderStats} isLoadingStats={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set Male (1) as missing' }));
    expect(toggleDiscreteMissingValue).toHaveBeenCalledWith('gender', 1, true);
  });

  it('calls onHoverChange when row is moused over', () => {
    const onHoverChange = vi.fn();
    render(
      <InspectorStats variable={genderVar} stats={genderStats} isLoadingStats={false} onHoverChange={onHoverChange} />,
    );

    const rows = document.querySelectorAll('tr');
    // First data row (skipping header)
    fireEvent.mouseEnter(rows[1]);
    expect(onHoverChange).toHaveBeenCalled();
  });

  it('calls onHoverChange with null when row is moused out', () => {
    const onHoverChange = vi.fn();
    render(
      <InspectorStats variable={genderVar} stats={genderStats} isLoadingStats={false} onHoverChange={onHoverChange} />,
    );

    const rows = document.querySelectorAll('tr');
    fireEvent.mouseLeave(rows[1]);
    expect(onHoverChange).toHaveBeenCalledWith(null);
  });

  it('enters inline edit mode when label is clicked', () => {
    render(<InspectorStats variable={genderVar} stats={genderStats} isLoadingStats={false} />);

    fireEvent.click(screen.getByText('Male'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls updateValueLabel when Enter is pressed in edit mode', () => {
    const { updateValueLabel } = setupStore();

    render(<InspectorStats variable={genderVar} stats={genderStats} isLoadingStats={false} />);

    fireEvent.click(screen.getByText('Male'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Men' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateValueLabel).toHaveBeenCalledWith('gender', '1', 'Men');
  });

  it('exits edit mode without saving when Escape is pressed', () => {
    const { updateValueLabel } = setupStore();

    render(<InspectorStats variable={genderVar} stats={genderStats} isLoadingStats={false} />);

    fireEvent.click(screen.getByText('Male'));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(updateValueLabel).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens ConvertSystemMissingModal when system missing button is clicked', () => {
    const varWithSystemMissing = makeVariable({
      id: 'var-sm',
      name: 'var_sm',
      type: 'categorical',
      valueLabels: [{ value: 1, label: 'Yes' }],
      missingValues: {},
    });

    const statsWithSystemMissing = {
      totalCount: 10,
      missingCount: 2,
      frequencies: [
        { value: 1, count: 8 },
        { value: null, count: 2 },
      ],
    } as any;

    render(<InspectorStats variable={varWithSystemMissing} stats={statsWithSystemMissing} isLoadingStats={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert system missing values' }));
    expect(screen.getByText('Convert System Missing')).toBeInTheDocument();
  });

  it('closes ConvertSystemMissingModal when canceled', async () => {
    const varWithSystemMissing = makeVariable({
      id: 'var-sm',
      name: 'var_sm',
      type: 'categorical',
      valueLabels: [{ value: 1, label: 'Yes' }],
      missingValues: {},
    });

    const statsWithSystemMissing = {
      totalCount: 10,
      missingCount: 2,
      frequencies: [
        { value: 1, count: 8 },
        { value: null, count: 2 },
      ],
    } as any;

    render(<InspectorStats variable={varWithSystemMissing} stats={statsWithSystemMissing} isLoadingStats={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert system missing values' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Convert System Missing')).not.toBeInTheDocument();
    });
  });
});
