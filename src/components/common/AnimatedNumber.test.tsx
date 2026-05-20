import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedNumber } from './AnimatedNumber';

describe('AnimatedNumber', () => {
  const pctFormatter = (n: number) => `${n.toFixed(1)}%`;

  it('renders static formatted value when reducedMotion is true', () => {
    render(<AnimatedNumber value={47.7} formatter={pctFormatter} reducedMotion />);
    expect(screen.getByText('47.7%')).toBeInTheDocument();
    expect(screen.queryByText('47.7%')).not.toHaveAttribute('data-animated');
  });

  it('renders motion span starting from zero when reducedMotion is false', () => {
    render(<AnimatedNumber value={47.7} formatter={pctFormatter} />);
    const span = screen.getByText('0.0%');
    expect(span).toHaveAttribute('data-animated', 'true');
  });

  it('accepts custom duration and delay', () => {
    render(<AnimatedNumber value={12} formatter={(n) => n.toFixed(0)} duration={0.2} delay={0.1} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0')).toHaveAttribute('data-animated', 'true');
  });
});
