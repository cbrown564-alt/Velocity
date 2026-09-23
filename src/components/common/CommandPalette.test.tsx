import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import { useVelocityStore } from '../../store';
import { resetPaletteOnboardingForTests, shouldShowPaletteOnboarding } from '../../lib/paletteOnboarding';

beforeEach(() => {
  resetPaletteOnboardingForTests();
  useVelocityStore.setState({
    commandPaletteOpen: true,
    commandPaletteInsertTarget: null,
    activeDatasetId: 'ds1',
    closeCommandPalette: vi.fn(() => useVelocityStore.setState({ commandPaletteOpen: false })),
    toggleAppMode: vi.fn(),
    reset: vi.fn(),
    addToast: vi.fn(),
    openShortcuts: vi.fn(),
    openFilterModal: vi.fn(),
    setTableConfig: vi.fn(),
    setWeightVariable: vi.fn(),
    tableConfig: { rowVars: [], colVar: null },
    variableSets: [
      { id: 'region', name: 'Region', structure: 'single', variableIds: ['region_var'] },
      { id: 'age', name: 'Age', structure: 'single', variableIds: ['age_var'], type: 'numeric' },
    ],
    dataset: {
      id: 'ds1',
      name: 'Demo',
      rowCount: 100,
      variables: [
        { id: 'region_var', name: 'region_var', label: 'Region of residence', type: 'nominal' },
        { id: 'age_var', name: 'age_var', label: 'Age in years', type: 'numeric' },
      ],
    },
    isWorkspaceMode: false,
    queryResult: [],
    slides: [],
    activeSlideId: null,
  } as any);
});

describe('CommandPalette (insert palette)', () => {
  it('does not render when closed', () => {
    useVelocityStore.setState({ commandPaletteOpen: false });
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText('Find a variable…')).not.toBeInTheDocument();
  });

  it('renders search input when open', () => {
    render(<CommandPalette />);
    expect(screen.getByPlaceholderText('Find a variable…')).toBeInTheDocument();
  });

  it('lists variables as the default result set on empty query', () => {
    render(<CommandPalette />);
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('shows categorical metadata from the underlying variable when the set type is stale', () => {
    useVelocityStore.setState({
      variableSets: [
        { id: 'cat_buyer', name: 'cat buyer', structure: 'single', variableIds: ['cat_buyer_var'], type: 'numeric' },
      ],
      dataset: {
        id: 'ds1',
        name: 'Demo',
        rowCount: 100,
        variables: [
          {
            id: 'cat_buyer_var',
            name: 'cat_buyer',
            label: 'Category buyer',
            type: 'categorical',
            valueLabels: [{ value: 1, label: 'Yes' }],
          },
        ],
      },
    } as any);
    render(<CommandPalette />);
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.queryByText('Numeric')).not.toBeInTheDocument();
  });

  it('matches variables on underlying labels', () => {
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: 'residence' } });
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.queryByText('Age')).not.toBeInTheDocument();
  });

  it('reveals the full selected question and its actual insertion destination', () => {
    const longLabel =
      'Which of these ready-to-drink chilled coffee brands would you consider buying in the next month?';
    useVelocityStore.setState({
      tableConfig: { rowVars: ['age'], colVar: null },
      variableSets: [
        { id: 'consider_a', name: 'consider_a', structure: 'single', variableIds: ['a'] },
        { id: 'consider_b', name: 'consider_b', structure: 'single', variableIds: ['b'] },
      ],
      dataset: {
        id: 'ds1',
        name: 'Demo',
        rowCount: 100,
        variables: [
          { id: 'a', name: 'consider_a', label: longLabel, type: 'categorical' },
          { id: 'b', name: 'consider_b', label: `${longLabel} (follow-up)`, type: 'categorical' },
        ],
      },
    } as any);
    render(<CommandPalette />);
    const input = screen.getByRole('textbox', { name: 'Find a variable' });
    fireEvent.change(input, { target: { value: 'consider' } });
    expect(screen.getByTestId('palette-selection-detail')).toHaveTextContent(longLabel);
    expect(screen.getByTestId('palette-selection-detail')).toHaveTextContent('Add to columns');
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByTestId('palette-selection-detail')).toHaveTextContent(`${longLabel} (follow-up)`);
    expect(screen.getByTestId('palette-variable-consider_b')).toHaveAttribute('title', `${longLabel} (follow-up)`);
  });

  it('describes redirected insertion as a row when the slide has no rows', () => {
    render(<CommandPalette />);
    expect(screen.getByTestId('palette-selection-detail')).toHaveTextContent('Add to rows');
  });

  it('Enter adds the selected variable to columns when rows exist', () => {
    const setTableConfig = vi.fn();
    useVelocityStore.setState({
      setTableConfig,
      tableConfig: { rowVars: ['age'], colVar: null },
    });
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: 'reg' } });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(setTableConfig).toHaveBeenCalledWith({ colVar: 'region' });
  });

  it('Enter redirects to rows with a column reject when no rows exist', () => {
    const setTableConfig = vi.fn();
    const rejectRecipeColumnPlacement = vi.fn();
    useVelocityStore.setState({ setTableConfig, rejectRecipeColumnPlacement });
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: 'reg' } });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(setTableConfig).toHaveBeenCalledWith({ rowVars: ['region'] });
    expect(rejectRecipeColumnPlacement).toHaveBeenCalled();
  });

  it('Alt+Enter adds the selected variable to rows', () => {
    const setTableConfig = vi.fn();
    useVelocityStore.setState({ setTableConfig });
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: 'reg' } });
    fireEvent.keyDown(document, { key: 'Enter', altKey: true });
    expect(setTableConfig).toHaveBeenCalledWith({ rowVars: ['region'] });
  });

  it('Shift+Enter opens the filter modal preselected to the variable', () => {
    const openFilterModal = vi.fn();
    useVelocityStore.setState({ openFilterModal });
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: 'reg' } });
    fireEvent.keyDown(document, { key: 'Enter', shiftKey: true });
    expect(openFilterModal).toHaveBeenCalledWith('region_var');
  });

  it('assigns weight when opened with the weight insert target', () => {
    const setWeightVariable = vi.fn();
    useVelocityStore.setState({
      commandPaletteInsertTarget: 'weight',
      setWeightVariable,
      variableSets: [{ id: 'wt', name: 'Weight var', structure: 'single', variableIds: ['wt_var'], type: 'numeric' }],
      dataset: {
        id: 'ds1',
        name: 'Demo',
        rowCount: 100,
        variables: [{ id: 'wt_var', name: 'wt', label: 'Weight', type: 'numeric' }],
      },
    } as any);
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(setWeightVariable).toHaveBeenCalledWith('wt_var');
  });

  it('adds to columns when opened with the columns insert target and rows exist', () => {
    const setTableConfig = vi.fn();
    useVelocityStore.setState({
      commandPaletteInsertTarget: 'columns',
      setTableConfig,
      tableConfig: { rowVars: ['gender'], colVar: null },
    });
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: 'reg' } });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(setTableConfig).toHaveBeenCalledWith({ colVar: 'region' });
  });

  it('click inserts to columns when rows exist', () => {
    const setTableConfig = vi.fn();
    useVelocityStore.setState({
      setTableConfig,
      tableConfig: { rowVars: ['gender'], colVar: null },
    });
    render(<CommandPalette />);
    fireEvent.click(screen.getByTestId('palette-variable-region'));
    expect(setTableConfig).toHaveBeenCalledWith({ colVar: 'region' });
  });

  it('shows commands behind the > prefix', () => {
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: '>' } });
    expect(screen.getByText('Reset Analysis')).toBeInTheDocument();
    expect(screen.getByText('Open Filters')).toBeInTheDocument();
  });

  it('filters commands by query after the prefix', () => {
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: '>reset' } });
    expect(screen.getByText('Reset Analysis')).toBeInTheDocument();
    expect(screen.queryByText('Open Filters')).not.toBeInTheDocument();
  });

  it('opens filter modal from command list', () => {
    const openFilterModal = vi.fn();
    useVelocityStore.setState({ openFilterModal });
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: '>filters' } });
    fireEvent.click(screen.getByText('Open Filters'));
    expect(openFilterModal).toHaveBeenCalled();
  });

  it('shows no results message for unmatched query', () => {
    render(<CommandPalette />);
    fireEvent.change(screen.getByPlaceholderText('Find a variable…'), { target: { value: 'xyznonexistent' } });
    expect(screen.getByText(/No matching variables/)).toBeInTheDocument();
  });

  it('closes on escape', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(false);
  });

  it('exposes dialog semantics on the panel', () => {
    render(<CommandPalette />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Command palette');
  });

  describe('palette onboarding ghost (DESIGN-CONV-D)', () => {
    it('shows the inline 3-step ghost on first palette open for a workspace', async () => {
      render(<CommandPalette />);
      const ghost = await screen.findByTestId('palette-onboarding-ghost');
      expect(ghost).toHaveTextContent('Search for a variable');
      // Pin shipped grammar (footer + resolveInsertTarget): ↵ columns, ⌥↵ rows.
      expect(ghost.textContent).toMatch(/Add to columns.*↵[\s\S]*Add to rows.*⌥↵/);
    });

    it('does not show the ghost when opened with a preset insert target', () => {
      useVelocityStore.setState({ commandPaletteInsertTarget: 'columns' });
      render(<CommandPalette />);
      expect(screen.queryByTestId('palette-onboarding-ghost')).not.toBeInTheDocument();
    });

    it('persists dismiss when Got it is clicked', async () => {
      render(<CommandPalette />);
      fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));
      expect(shouldShowPaletteOnboarding('ds1')).toBe(false);
      expect(screen.queryByTestId('palette-onboarding-ghost')).not.toBeInTheDocument();
    });

    it('does not re-show the ghost after dismiss on a later palette open', async () => {
      const { rerender } = render(<CommandPalette />);
      fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));

      act(() => {
        useVelocityStore.setState({ commandPaletteOpen: false });
      });
      rerender(<CommandPalette />);
      act(() => {
        useVelocityStore.setState({ commandPaletteOpen: true });
      });
      rerender(<CommandPalette />);

      await waitFor(() => {
        expect(screen.queryByTestId('palette-onboarding-ghost')).not.toBeInTheDocument();
      });
    });

    it('persists dismiss when the palette is closed with escape', async () => {
      render(<CommandPalette />);
      await screen.findByTestId('palette-onboarding-ghost');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(shouldShowPaletteOnboarding('ds1')).toBe(false);

      act(() => {
        useVelocityStore.setState({ commandPaletteOpen: true });
      });
      render(<CommandPalette />);
      await waitFor(() => {
        expect(screen.queryByTestId('palette-onboarding-ghost')).not.toBeInTheDocument();
      });
    });

    it('scopes dismiss per workspace', async () => {
      render(<CommandPalette />);
      fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));
      expect(shouldShowPaletteOnboarding('ds1')).toBe(false);
      expect(shouldShowPaletteOnboarding('ds2')).toBe(true);
    });
  });
});
