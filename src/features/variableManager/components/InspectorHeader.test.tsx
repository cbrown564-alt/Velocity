import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectorHeader } from './InspectorHeader';
import { useVelocityStore } from '../../../store';
import { makeVariable } from '../../../test/fixtures/variables';

const updateVariableMetadata = vi.fn();

beforeEach(() => {
  updateVariableMetadata.mockReset();
  useVelocityStore.setState({
    updateVariableMetadata,
  });
});

const genderVar = makeVariable({
  id: 'gender',
  name: 'Q1_Gender',
  label: 'Gender',
  type: 'categorical',
  valueLabels: [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
  ],
  missingValues: {},
});

describe('InspectorHeader', () => {
  it('renders variable name and label', () => {
    render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={false} />);
    expect(screen.getByText('Q1_Gender')).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={false} />);
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  it('renders numeric type badge for numeric variable', () => {
    const numVar = makeVariable({ id: 'age', name: 'age', label: 'Age', type: 'numeric' });
    render(<InspectorHeader variable={numVar} stats={null} isLoadingStats={false} />);
    expect(screen.getByText('Numeric')).toBeInTheDocument();
  });

  it('renders ordered type badge', () => {
    const ordVar = makeVariable({ id: 'sat', name: 'sat', label: 'Satisfaction', type: 'ordered' });
    render(<InspectorHeader variable={ordVar} stats={null} isLoadingStats={false} />);
    expect(screen.getByText('Scale')).toBeInTheDocument();
  });

  it('shows valid count when stats are provided', () => {
    const stats = { totalCount: 150, missingCount: 10, frequencies: [] } as any;
    render(<InspectorHeader variable={genderVar} stats={stats} isLoadingStats={false} />);
    // valid = 150 - 10 = 140
    expect(screen.getByText(/140/)).toBeInTheDocument();
  });

  it('shows missing count when missingCount > 0', () => {
    const stats = { totalCount: 200, missingCount: 20, frequencies: [] } as any;
    render(<InspectorHeader variable={genderVar} stats={stats} isLoadingStats={false} />);
    expect(screen.getByText(/Missing/)).toBeInTheDocument();
  });

  it('does not show missing when missingCount is 0', () => {
    const stats = { totalCount: 100, missingCount: 0, frequencies: [] } as any;
    render(<InspectorHeader variable={genderVar} stats={stats} isLoadingStats={false} />);
    expect(screen.queryByText(/Missing/)).toBeNull();
  });

  it('shows category count badge for categorical variable with value labels', () => {
    render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={false} />);
    expect(screen.getByText(/2 categories/)).toBeInTheDocument();
  });

  it('shows loading pulse when isLoadingStats', () => {
    const { container } = render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={true} />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('enters inline label edit mode when label is clicked', () => {
    render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={false} />);
    fireEvent.click(screen.getByText('Gender'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('commits label change on Enter key', () => {
    render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={false} />);
    fireEvent.click(screen.getByText('Gender'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Sex' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateVariableMetadata).toHaveBeenCalledWith('gender', { label: 'Sex' });
  });

  it('exits edit mode without saving on Escape', () => {
    render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={false} />);
    fireEvent.click(screen.getByText('Gender'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(updateVariableMetadata).not.toHaveBeenCalled();
    expect(screen.getByText('Gender')).toBeInTheDocument();
  });

  it('enters name edit mode when variable name code is clicked', () => {
    render(<InspectorHeader variable={genderVar} stats={null} isLoadingStats={false} />);
    fireEvent.click(screen.getByText('Q1_Gender'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
