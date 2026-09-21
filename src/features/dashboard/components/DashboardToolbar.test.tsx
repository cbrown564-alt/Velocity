import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardToolbar } from './DashboardToolbar';
import { useVelocityStore } from '../../../store';
import type { Slide } from '../../../types/slides';

const slide: Slide = {
  id: 'slide-1',
  title: 'Test slide',
  subtitle: '',
  analysisState: { rowVars: ['gender'], colVar: null, filters: [], weightVar: null },
  visualizationType: 'table',
  layoutMode: 'focus',
  cells: [{ id: 'cell-1', content: { type: 'table' } }],
  createdAt: 1,
  updatedAt: 1,
};

const baseProps = {
  dataset: { id: 'ds1', name: 'demo.sav', rowCount: 100, variables: [], source: 'sav' as const },
  activeSlideId: 'slide-1',
  activeSlide: slide,
  canOpenExport: true,
  recipeOpen: false,
  onToggleRecipe: vi.fn(),
  onReturnToWorkspace: vi.fn(),
  onOpenSessionImport: vi.fn(),
  onExportSession: vi.fn(),
  onExport: vi.fn(),
  onReset: vi.fn(),
};

describe('DashboardToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.setState({ commandPaletteOpen: false });
  });

  it('renders quiet chrome with view toggle, recipe, insert, and export', () => {
    render(<DashboardToolbar {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Table view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chart view' })).toBeInTheDocument();
    expect(screen.getByTestId('recipe-inspector-toggle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /insert/i })).toBeInTheDocument();
    expect(screen.getByTestId('export-slide-button')).toBeInTheDocument();
  });

  it('opens the insert palette via the toolbar button', () => {
    render(<DashboardToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /insert/i }));
    expect(useVelocityStore.getState().commandPaletteOpen).toBe(true);
  });

  it('routes overflow actions to Variable Manager', () => {
    render(<DashboardToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Variable Manager' }));
    expect(useVelocityStore.getState().appMode).toBe('variables');
  });

  it('calls export and recipe toggle handlers', () => {
    render(<DashboardToolbar {...baseProps} />);
    fireEvent.click(screen.getByTestId('export-slide-button'));
    expect(baseProps.onExport).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('recipe-inspector-toggle'));
    expect(baseProps.onToggleRecipe).toHaveBeenCalled();
  });

  it('switches visualization type from the view toggle', () => {
    const setSlideVisualizationType = vi.fn();
    useVelocityStore.setState({ setSlideVisualizationType });
    render(<DashboardToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chart view' }));
    expect(setSlideVisualizationType).toHaveBeenCalledWith('slide-1', 'chart');
  });

  it('returns to workspace from toolbar home control', () => {
    render(<DashboardToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Return to Workspace' }));
    expect(baseProps.onReturnToWorkspace).toHaveBeenCalled();
  });

  it('routes overflow session and reset actions', () => {
    render(<DashboardToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import Session' }));
    expect(baseProps.onOpenSessionImport).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export Session' }));
    expect(baseProps.onExportSession).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset' }));
    expect(baseProps.onReset).toHaveBeenCalled();
  });

  it('closes the overflow menu on Escape', () => {
    render(<DashboardToolbar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('stacks the overflow menu above sticky chrome and closes on outside click (DESIGN-CONV-K3)', () => {
    render(
      <div>
        <button type="button">Outside</button>
        <DashboardToolbar {...baseProps} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('toolbar-overflow-trigger'));
    const menu = screen.getByTestId('toolbar-overflow-menu');
    expect(menu.className).toContain('z-[var(--z-menu)]');
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByTestId('toolbar-overflow-menu')).not.toBeInTheDocument();
  });
});
