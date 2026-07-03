import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import { useVelocityStore } from '../../store';

beforeEach(() => {
  useVelocityStore.setState({
    commandPaletteOpen: true,
    closeCommandPalette: vi.fn(() => useVelocityStore.setState({ commandPaletteOpen: false })),
    toggleAppMode: vi.fn(),
    toggleFocusMode: vi.fn(),
    reset: vi.fn(),
    addToast: vi.fn(),
    openShortcuts: vi.fn(),
    openFilterModal: vi.fn(),
    setTableConfig: vi.fn(),
    setWeightVariable: vi.fn(),
    tableConfig: { rowVars: [], colVar: null },
    variableSets: [{ id: 'region', name: 'Region', structure: 'single', variableIds: ['region_var'] }],
    dataset: {
      id: 'ds1',
      name: 'Demo',
      rowCount: 100,
      variables: [{ id: 'region_var', name: 'region_var', label: 'Region', type: 'nominal' }],
    },
    isWorkspaceMode: false,
    queryResult: [],
    slides: [],
    activeSlideId: null,
  } as any);
});


describe('CommandPalette', () => {
  it('does not render when closed', () => {
    useVelocityStore.setState({ commandPaletteOpen: false });
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText('Type a command or search variables...')).not.toBeInTheDocument();
  });

  it('renders search input when open', () => {
    render(<CommandPalette />);
    expect(screen.getByPlaceholderText('Type a command or search variables...')).toBeInTheDocument();
  });

  it('filters commands based on query', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Type a command or search variables...');
    fireEvent.change(input, { target: { value: 'focus' } });
    expect(screen.getByText('Toggle Focus Mode')).toBeInTheDocument();
    expect(screen.queryByText('Reset Analysis')).not.toBeInTheDocument();
  });

  it('shows variable shelf actions when searching variables', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Type a command or search variables...');
    fireEvent.change(input, { target: { value: 'reg' } });
    expect(screen.getByText('Add Region to Columns')).toBeInTheDocument();
    expect(screen.getByText('Add Region to Rows')).toBeInTheDocument();
  });

  it('adds a matched variable to columns', () => {
    const setTableConfig = vi.fn();
    useVelocityStore.setState({ setTableConfig });
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Type a command or search variables...');
    fireEvent.change(input, { target: { value: 'reg' } });
    fireEvent.click(screen.getByText('Add Region to Columns'));
    expect(setTableConfig).toHaveBeenCalledWith({ colVar: 'region' });
  });

  it('opens filter modal from command list', () => {
    const openFilterModal = vi.fn();
    useVelocityStore.setState({ openFilterModal });
    render(<CommandPalette />);
    fireEvent.click(screen.getByText('Open Filters'));
    expect(openFilterModal).toHaveBeenCalled();
  });

  it('shows no results message for unmatched query', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Type a command or search variables...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText(/No commands found/)).toBeInTheDocument();
  });

  it('closes on escape', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(false);
  });

  it('executes action on click', () => {
    const toggleFocus = vi.fn();
    useVelocityStore.setState({ toggleFocusMode: toggleFocus });
    render(<CommandPalette />);
    fireEvent.click(screen.getByText('Toggle Focus Mode'));
    expect(toggleFocus).toHaveBeenCalled();
  });

  it('exposes dialog semantics on the panel', () => {
    render(<CommandPalette />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Command palette');
  });
});
