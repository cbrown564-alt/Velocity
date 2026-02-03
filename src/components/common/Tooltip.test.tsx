import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('shows tooltip on hover after delay', async () => {
    vi.useFakeTimers();

    render(
      <Tooltip content="Test tooltip content" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button.parentElement!);

    // Tooltip should not be visible yet
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Advance timers past delay
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Test tooltip content')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('hides tooltip on mouse leave', async () => {
    vi.useFakeTimers();

    render(
      <Tooltip content="Test tooltip" delay={100}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button.parentElement!);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(button.parentElement!);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('does not show tooltip when disabled', async () => {
    vi.useFakeTimers();

    render(
      <Tooltip content="Test tooltip" delay={100} disabled>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button.parentElement!);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
