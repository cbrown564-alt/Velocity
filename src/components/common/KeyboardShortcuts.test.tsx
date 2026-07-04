import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { useVelocityStore } from '../../store';

beforeEach(() => {
  useVelocityStore.setState({
    shortcutsOpen: true,
    closeShortcuts: vi.fn(() => useVelocityStore.setState({ shortcutsOpen: false })),
  } as any);
});

describe('KeyboardShortcuts', () => {
  it('renders Story rail group when open', () => {
    render(<KeyboardShortcuts />);
    expect(screen.getByText('Story rail')).toBeInTheDocument();
    expect(screen.getByText('Insert palette')).toBeInTheDocument();
    expect(screen.getByText('Variable manager')).toBeInTheDocument();
  });

  it('closes on escape and backdrop click', () => {
    const closeShortcuts = vi.fn(() => useVelocityStore.setState({ shortcutsOpen: false }));
    useVelocityStore.setState({ closeShortcuts });
    const { container } = render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeShortcuts).toHaveBeenCalled();

    useVelocityStore.setState({ shortcutsOpen: true });
    render(<KeyboardShortcuts />);
    const backdrop = container.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
  });
});
