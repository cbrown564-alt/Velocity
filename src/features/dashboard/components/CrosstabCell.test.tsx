import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrosstabCell } from './CrosstabCell';

describe('CrosstabCell', () => {
  it('stacks frequency percent and sample size right-aligned (strategy A)', () => {
    render(
      <CrosstabCell variant="frequency" percent={47.7} count={21} sig="high_95" />
    );
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
  });

  it('does not warn on adequate sample sizes', () => {
    render(<CrosstabCell variant="frequency" percent={47.7} count={131} />);
    expect(screen.getByText('n=131')).not.toHaveAttribute('data-small-base');
  });

  describe('animation (Settling Scale)', () => {
    it('animates percent when animationTrigger is provided', () => {
      render(
        <CrosstabCell variant="frequency" percent={47.7} count={21} animationTrigger="v1" />
      );
      const animated = screen.getByText('0.0%');
      expect(animated).toHaveAttribute('data-animated', 'true');
    });

    it('animates mean when animationTrigger is provided', () => {
      render(
        <CrosstabCell variant="metric" mean={3.2} count={44} animationTrigger="v1" />
      );
      const animated = screen.getByText('0.0');
      expect(animated).toHaveAttribute('data-animated', 'true');
    });

    it('animates count when animationTrigger is provided', () => {
      render(
        <CrosstabCell variant="count" count={48} animationTrigger="v1" />
      );
      const animated = screen.getByText('0');
      expect(animated).toHaveAttribute('data-animated', 'true');
    });

    it('renders static value when reducedMotion is true even with trigger', () => {
      render(
        <CrosstabCell variant="frequency" percent={47.7} count={21} animationTrigger="v1" reducedMotion />
      );
      expect(screen.getByText('47.7%')).toBeInTheDocument();
      expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    });

    it('spring-locks significance marker when animationTrigger is provided', () => {
      render(
        <CrosstabCell variant="frequency" percent={47.7} count={21} sig="high_95" animationTrigger="v1" />
      );
      const marker = screen.getByTestId('crosstab-cell-frequency').querySelector('[data-animated="true"]');
      expect(marker).toBeInTheDocument();
    });
  });

  describe('phosphor persistence (Mission Control only)', () => {
    beforeEach(() => {
      document.documentElement.setAttribute('data-theme', 'mission-control');
    });

    afterEach(() => {
      document.documentElement.removeAttribute('data-theme');
    });

    it('renders phosphor ghost with old value when animationTrigger changes', () => {
      const { rerender } = render(
        <CrosstabCell variant="frequency" percent={47.7} count={21} animationTrigger="v1" />
      );
      rerender(
        <CrosstabCell variant="frequency" percent={52.3} count={21} animationTrigger="v2" />
      );
      const ghosts = screen.getByTestId('crosstab-cell-frequency').querySelectorAll('.phosphor-ghost');
      expect(ghosts.length).toBeGreaterThan(0);
      expect(ghosts[0]).toHaveTextContent('47.7%');
    });

    it('does not render phosphor ghost in Soft Machine theme', () => {
      document.documentElement.setAttribute('data-theme', 'soft-machine');
      const { rerender } = render(
        <CrosstabCell variant="frequency" percent={47.7} count={21} animationTrigger="v1" />
      );
      rerender(
        <CrosstabCell variant="frequency" percent={52.3} count={21} animationTrigger="v2" />
      );
      const ghosts = screen.getByTestId('crosstab-cell-frequency').querySelectorAll('.phosphor-ghost');
      expect(ghosts.length).toBe(0);
    });

    it('renders metric phosphor ghost on trigger change', () => {
      const { rerender } = render(
        <CrosstabCell variant="metric" mean={3.2} count={44} animationTrigger="v1" />
      );
      rerender(
        <CrosstabCell variant="metric" mean={4.1} count={44} animationTrigger="v2" />
      );
      const ghosts = screen.getByTestId('crosstab-cell-metric').querySelectorAll('.phosphor-ghost');
      expect(ghosts.length).toBeGreaterThan(0);
      expect(ghosts[0]).toHaveTextContent('3.2');
    });

    it('renders count phosphor ghost on trigger change', () => {
      const { rerender } = render(
        <CrosstabCell variant="count" count={48} animationTrigger="v1" />
      );
      rerender(
        <CrosstabCell variant="count" count={55} animationTrigger="v2" />
      );
      const ghosts = screen.getByTestId('crosstab-cell-count').querySelectorAll('.phosphor-ghost');
      expect(ghosts.length).toBeGreaterThan(0);
      expect(ghosts[0]).toHaveTextContent('48');
    });
  });
});
