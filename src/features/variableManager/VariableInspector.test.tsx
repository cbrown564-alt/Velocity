import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VariableInspector } from './VariableInspector';
import { useVelocityStore } from '../../store';

beforeEach(() => {
  useVelocityStore.setState({
    dataset: null,
    selectedVariableId: null,
    variableStats: {},
    getVariableStats: vi.fn().mockResolvedValue(undefined),
    updateValueLabel: vi.fn(),
    toggleDiscreteMissingValue: vi.fn(),
    fillSystemMissing: vi.fn(),
  });
});

describe('VariableInspector', () => {
  it('shows empty state when no variable is selected', () => {
    render(<VariableInspector />);
    expect(screen.getByText(/select a variable/i)).toBeInTheDocument();
  });

  it('renders variable inspector column container', () => {
    const { container } = render(<VariableInspector />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
