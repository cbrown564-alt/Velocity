import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatisticsTooltip } from './StatisticsTooltip';

describe('StatisticsTooltip', () => {
  const mockStats = {
    tScore: 2.45,
    pValue: 0.0143,
    effN: 75.3,
  };

  it('renders Welch T-Test header', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig="high_95"
        value={45.2}
      />
    );

    expect(screen.getByText("Welch's T-Test")).toBeInTheDocument();
    expect(screen.getByText('Cell vs Rest Comparison')).toBeInTheDocument();
  });

  it('displays t-score, p-value, and ESS', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig="high_95"
        value={45.2}
      />
    );

    expect(screen.getByText('2.45')).toBeInTheDocument(); // t-score
    expect(screen.getByText('0.014')).toBeInTheDocument(); // p-value
    expect(screen.getByText('75.3')).toBeInTheDocument(); // ESS
  });

  it('shows significantly higher message for high_95', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig="high_95"
        value={45.2}
      />
    );

    expect(screen.getByText('Significantly higher (95% confidence)')).toBeInTheDocument();
  });

  it('shows significantly lower message for low_95', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig="low_95"
        value={45.2}
      />
    );

    expect(screen.getByText('Significantly lower (95% confidence)')).toBeInTheDocument();
  });

  it('shows moderately higher message for high_80', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig="high_80"
        value={45.2}
      />
    );

    expect(screen.getByText('Moderately higher (80% confidence)')).toBeInTheDocument();
  });

  it('shows moderately lower message for low_80', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig="low_80"
        value={45.2}
      />
    );

    expect(screen.getByText('Moderately lower (80% confidence)')).toBeInTheDocument();
  });

  it('shows not significant message when sig is undefined', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig={undefined}
        value={45.2}
      />
    );

    expect(screen.getByText('Not statistically significant')).toBeInTheDocument();
  });

  it('formats very small p-values correctly', () => {
    const smallPValue = { ...mockStats, pValue: 0.0001 };
    render(
      <StatisticsTooltip
        stats={smallPValue}
        sig="high_95"
        value={45.2}
      />
    );

    expect(screen.getByText('<0.001')).toBeInTheDocument();
  });

  it('shows ESS methodology note', () => {
    render(
      <StatisticsTooltip
        stats={mockStats}
        sig="high_95"
        value={45.2}
      />
    );

    expect(screen.getByText(/Kish's Approximation/)).toBeInTheDocument();
  });
});
