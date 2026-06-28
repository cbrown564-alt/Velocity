import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import { useVelocityStore } from '../../store';
import { ThemeProvider } from '../../context/ThemeContext';

// Reset store state before each test
beforeEach(() => {
  useVelocityStore.setState({
    commandPaletteOpen: true,
    closeCommandPalette: vi.fn(() => useVelocityStore.setState({ commandPaletteOpen: false })),
    toggleAppMode: vi.fn(),
    toggleFocusMode: vi.fn(),
    reset: vi.fn(),
    addToast: vi.fn(),
    openShortcuts: vi.fn(),
  } as any);
});

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    useVelocityStore.setState({ commandPaletteOpen: false });
    render(<CommandPalette />, { wrapper: Wrapper });
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
  });

  it('renders search input when open', () => {
    render(<CommandPalette />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
  });

  it('filters commands based on query', () => {
    render(<CommandPalette />, { wrapper: Wrapper });
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'focus' } });
    expect(screen.getByText('Toggle Focus Mode')).toBeInTheDocument();
    expect(screen.queryByText('Reset Analysis')).not.toBeInTheDocument();
  });

  it('shows no results message for unmatched query', () => {
    render(<CommandPalette />, { wrapper: Wrapper });
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No commands found')).toBeInTheDocument();
  });

  it('closes on escape', () => {
    render(<CommandPalette />, { wrapper: Wrapper });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(false);
  });

  it('executes action on click', () => {
    const toggleFocus = vi.fn();
    useVelocityStore.setState({ toggleFocusMode: toggleFocus });
    render(<CommandPalette />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('Toggle Focus Mode'));
    expect(toggleFocus).toHaveBeenCalled();
  });
});
