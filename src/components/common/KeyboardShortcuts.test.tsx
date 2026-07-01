import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { useVelocityStore } from '../../store';

beforeEach(() => {
  useVelocityStore.setState({
    shortcutsOpen: true,
    closeShortcuts: vi.fn(() => useVelocityStore.setState({ shortcutsOpen: false })),
  } as any);
});

describe('KeyboardShortcuts', () => {
  it('does not render when closed', () => {
    useVelocityStore.setState({ shortcutsOpen: false });
    render(<KeyboardShortcuts />);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(<KeyboardShortcuts />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('renders shortcut groups', () => {
    render(<KeyboardShortcuts />);
    expect(screen.getByText('Commands')).toBeInTheDocument();
    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('renders specific shortcuts', () => {
    render(<KeyboardShortcuts />);
    expect(screen.getByText('Toggle Variable Manager')).toBeInTheDocument();
    expect(screen.getByText('Toggle Focus Mode')).toBeInTheDocument();
    expect(screen.getByText('Previous slide')).toBeInTheDocument();
  });

  it('closes on escape', () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useVelocityStore.getState().shortcutsOpen).toBe(false);
  });

  it('closes on close button click', () => {
    render(<KeyboardShortcuts />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(useVelocityStore.getState().shortcutsOpen).toBe(false);
  });
});
