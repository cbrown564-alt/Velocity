import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { InspectorDistribution } from './InspectorDistribution';
import { makeVariable } from '../../../test/fixtures/variables';

vi.mock('../../../hooks/useResizeObserver', () => ({
  useResizeObserver: vi.fn().mockReturnValue({ width: 300, height: 200 }),
}));

vi.mock('../../../components/charts/renderers', () => ({
  HorizontalBarRenderer: () => <div data-testid="bar-renderer" />,
  HistogramRenderer: () => <div data-testid="histogram-renderer" />,
  VerticalBarRenderer: () => <div data-testid="vertical-bar-renderer" />,
}));

const genderVar = makeVariable({
  id: 'gender',
  name: 'gender',
  label: 'Gender',
  type: 'categorical',
  valueLabels: [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
  ],
  missingValues: {},
});

describe('InspectorDistribution', () => {
  it('renders nothing when stats are null', () => {
    const { container } = render(
      <InspectorDistribution
        variable={genderVar}
        stats={null}
        isNumericVariable={false}
        selectedKeys={new Set()}
        setSelectedKeys={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders chart when stats are provided', () => {
    const stats = {
      totalCount: 100,
      missingCount: 0,
      frequencies: [
        { value: 1, count: 55 },
        { value: 2, count: 45 },
      ],
    } as any;

    const { container } = render(
      <InspectorDistribution
        variable={genderVar}
        stats={stats}
        isNumericVariable={false}
        selectedKeys={new Set()}
        setSelectedKeys={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
