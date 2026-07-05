import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrosstabCell } from './CrosstabCell';

describe('CrosstabCell', () => {
  it('hides cell n when showCellN is false', () => {
    render(<CrosstabCell variant="frequency" percent={47.7} count={21} showCellN={false} />);
    expect(screen.getByText('47.7%')).toBeInTheDocument();
    expect(screen.queryByText('n=21')).not.toBeInTheDocument();
  });

  it('stacks frequency percent and sample size right-aligned (strategy A)', () => {
    render(<CrosstabCell variant="frequency" percent={47.7} count={21} sig="high_95" />);
    expect(screen.getByText('47.7%')).toBeInTheDocument();
    expect(screen.getByText('n=21')).toBeInTheDocument();
    expect(screen.getByText('n=21')).toBeVisible();
    const stack = screen.getByTestId('crosstab-cell-frequency');
    expect(stack).toHaveClass('items-end', 'text-right');
  });

  it('right-aligns column base count stack', () => {
    render(<CrosstabCell variant="count" count={49} />);
    expect(screen.getByTestId('crosstab-cell-count')).toHaveClass('items-end', 'text-right');
  });

  it('stacks metric mean and sample size', () => {
    render(<CrosstabCell variant="metric" mean={3.2} count={44} showMeanBadge />);
    expect(screen.getByText('3.2')).toBeInTheDocument();
    expect(screen.getByText('n=44')).toBeInTheDocument();
    expect(screen.getByText('Mean')).toBeInTheDocument();
  });

  it('renders column base count with label', () => {
    render(<CrosstabCell variant="count" count={48} />);
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('base')).toBeInTheDocument();
  });

  it('uses smaller type for marginal count cells', () => {
    render(<CrosstabCell variant="count" count={48} size="marginal" />);
    expect(screen.getByText('48')).toHaveClass('text-xs');
  });

  it('warns on small sample sizes (n < 30)', () => {
    render(<CrosstabCell variant="frequency" percent={47.7} count={12} />);
    expect(screen.getByText('n=12')).toHaveAttribute('data-small-base', 'true');
    expect(screen.getByText('n=12').closest('.crosstab-small-base')).toBeTruthy();
  });

  it('does not warn on adequate sample sizes', () => {
    render(<CrosstabCell variant="frequency" percent={47.7} count={131} />);
    expect(screen.getByText('n=131')).not.toHaveAttribute('data-small-base');
  });

  it('removes frequency n= from layout flow when showCellN is false (UXP-040)', () => {
    render(<CrosstabCell variant="frequency" percent={47.7} count={21} showCellN={false} />);
    expect(screen.getByText('47.7%')).toBeInTheDocument();
    expect(screen.queryByText('n=21')).not.toBeInTheDocument();
    // No reserved placeholder: the stack has exactly one child row
    expect(screen.getByTestId('crosstab-cell-frequency').childElementCount).toBe(1);
  });

  it('removes metric n= but keeps SD when showCellN is false (UXP-040)', () => {
    render(<CrosstabCell variant="metric" mean={3.2} count={44} stdDev={1.1} showCellN={false} />);
    expect(screen.queryByText(/n=44/)).not.toBeInTheDocument();
    expect(screen.getByText(/SD: 1.1/)).toBeInTheDocument();
  });

  it('renders em-dash for zero frequency cells instead of 0%', () => {
    render(<CrosstabCell variant="frequency" isZero percent={0} count={0} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('n=0')).not.toBeInTheDocument();
    expect(screen.getByTestId('crosstab-cell-frequency')).toHaveAttribute('data-zero-cell', 'true');
  });

  it('renders em-dash for zero metric cells', () => {
    render(<CrosstabCell variant="metric" isZero mean={0} count={0} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.queryByText('n=0')).not.toBeInTheDocument();
  });

  describe('animation (Settling Scale)', () => {
    it('animates percent when animationTrigger is provided', () => {
      render(<CrosstabCell variant="frequency" percent={47.7} count={21} animationTrigger="v1" />);
      const animated = screen.getByText('0.0%');
      expect(animated).toHaveAttribute('data-animated', 'true');
    });

    it('animates mean when animationTrigger is provided', () => {
      render(<CrosstabCell variant="metric" mean={3.2} count={44} animationTrigger="v1" />);
      const animated = screen.getByText('0.0');
      expect(animated).toHaveAttribute('data-animated', 'true');
    });

    it('animates count when animationTrigger is provided', () => {
      render(<CrosstabCell variant="count" count={48} animationTrigger="v1" />);
      const animated = screen.getByText('0');
      expect(animated).toHaveAttribute('data-animated', 'true');
    });

    it('renders static value when reducedMotion is true even with trigger', () => {
      render(<CrosstabCell variant="frequency" percent={47.7} count={21} animationTrigger="v1" reducedMotion />);
      expect(screen.getByText('47.7%')).toBeInTheDocument();
      expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    });

    it('spring-locks significance marker when animationTrigger is provided', () => {
      render(<CrosstabCell variant="frequency" percent={47.7} count={21} sig="high_95" animationTrigger="v1" />);
      const marker = screen.getByTestId('crosstab-cell-frequency').querySelector('[data-animated="true"]');
      expect(marker).toBeInTheDocument();
    });
  });
});
