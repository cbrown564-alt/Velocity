import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline, MissingnessBadge } from './Sparkline';

describe('Sparkline', () => {
  it('renders null for numeric type with no histogram bins', () => {
    const { container } = render(<Sparkline type="numeric" histogramBins={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG bars for numeric type with histogram bins', () => {
    const bins = [
      { x0: 0, x1: 10, count: 5 },
      { x0: 10, x1: 20, count: 15 },
      { x0: 20, x1: 30, count: 8 },
    ];
    const { container } = render(<Sparkline type="numeric" histogramBins={bins} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const rects = svg!.querySelectorAll('rect');
    expect(rects.length).toBe(3);
  });

  it('renders SVG distribution strip for ordered type with frequencies', () => {
    const { container } = render(<Sparkline type="ordered" frequencies={[10, 20, 30, 15, 5]} width={60} height={16} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('renders null for ordered type with empty frequencies', () => {
    const { container } = render(<Sparkline type="ordered" frequencies={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when categorical with no topCategory', () => {
    const { container } = render(<Sparkline type="categorical" frequencies={[1, 2, 3]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders leaderboard div for categorical type with topCategory', () => {
    const { container } = render(
      <Sparkline type="categorical" topCategory={{ label: 'Male', percent: 60, count: 120 }} width={60} height={16} />,
    );
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain('Male');
    expect(container.textContent).toContain('60%');
  });

  it('respects maxBars limit for ordered type', () => {
    // 7 frequencies but maxBars=3; only 3 segments rendered
    const { container } = render(<Sparkline type="ordered" frequencies={[10, 20, 30, 15, 5, 8, 12]} maxBars={3} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // Mask rect + 3 segments = 4 total rects (first is mask)
    const rects = svg!.querySelectorAll('rect');
    expect(rects.length).toBeLessThanOrEqual(4);
    expect(rects.length).toBeGreaterThanOrEqual(1);
  });

  it('renders SVG with date type and histogram bins', () => {
    const bins = [
      { x0: 0, x1: 10, count: 3 },
      { x0: 10, x1: 20, count: 7 },
    ];
    const { container } = render(<Sparkline type="date" histogramBins={bins} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

describe('MissingnessBadge', () => {
  it('renders nothing when missingPercent is below threshold', () => {
    const { container } = render(<MissingnessBadge missingPercent={0.5} threshold={1} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders badge when missingPercent exceeds threshold', () => {
    const { container } = render(<MissingnessBadge missingPercent={5} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('shows percentage text when moderate missing (>=5%)', () => {
    const { container } = render(<MissingnessBadge missingPercent={10} />);
    expect(container.textContent).toContain('10%');
  });

  it('does not show percentage text when missing is below moderate threshold', () => {
    const { container } = render(<MissingnessBadge missingPercent={2} />);
    // Below 5% threshold, no percentage text shown
    expect(container.querySelector('span')).toBeNull();
  });

  it('uses custom threshold', () => {
    const { container } = render(<MissingnessBadge missingPercent={3} threshold={5} />);
    expect(container.firstChild).toBeNull();
  });
});
