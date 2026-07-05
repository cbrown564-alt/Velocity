import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { RecipeInspector } from './RecipeInspector';
import { useVelocityStore } from '../../../store';

const wrapper = ({ children }: { children: React.ReactNode }) => <DndContext>{children}</DndContext>;

describe('RecipeInspector', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      variableSets: [
        { id: 'gender', name: 'Q5_gender', variableIds: ['v-g'], type: 'categorical', structure: 'single' },
        { id: 'region', name: 'SEG', variableIds: ['v-r'], type: 'categorical', structure: 'single' },
      ],
      dataset: { id: 'ds1', name: 'demo.sav', rowCount: 271, variables: [], source: 'sav' },
      activeFilters: [],
      analysisSettings: {
        showCellN: false,
        showColumnBases: false,
        comparisonMethod: 'cell_vs_rest',
        correctionType: 'none',
        showConfidenceIntervals: false,
        significanceLevel: 0.95,
        engine: 'auto',
      },
      slides: [
        {
          id: 'slide-1',
          title: 'Slide',
          subtitle: '',
          analysisState: { rowVars: ['gender'], colVar: 'region', filters: [], weightVar: null },
          visualizationType: 'table',
          layoutMode: 'focus',
          cells: [{ id: 'c1', content: { type: 'table' } }],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeSlideId: 'slide-1',
      setTableConfig: vi.fn(),
      updateAnalysisSettings: vi.fn(),
      openFilterModal: vi.fn(),
    });
  });

  it('shakes the columns field when a column-first placement is rejected', () => {
    useVelocityStore.setState({ recipeColumnRejectNonce: 1 });
    const { container } = render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    expect(container.querySelector('[class*="rejectShake"]')).toBeTruthy();
  });

  it('renders draggable recipe chips for rows and columns', () => {
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText('Q5_gender').closest('.cursor-grab')).toBeTruthy();
    expect(screen.getByText('SEG').closest('.cursor-grab')).toBeTruthy();
  });

  it('shows recipe chips and display settings when open', () => {
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText(/Recipe — Slide 1/)).toBeInTheDocument();
    expect(screen.getByText('Q5_gender')).toBeInTheDocument();
    expect(screen.getByText('SEG')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show cell n' })).toBeInTheDocument();
  });

  it('toggles cell n display setting', () => {
    const updateAnalysisSettings = vi.fn();
    useVelocityStore.setState({ updateAnalysisSettings });
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Show cell n' }));
    expect(updateAnalysisSettings).toHaveBeenCalledWith({ showCellN: true });
  });

  it('removes row variables from chips', () => {
    const setTableConfig = vi.fn();
    useVelocityStore.setState({ setTableConfig });
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Q5_gender from rows' }));
    expect(setTableConfig).toHaveBeenCalledWith({ rowVars: [] });
  });

  it('opens filter modal from add filter control', () => {
    const openFilterModal = vi.fn();
    useVelocityStore.setState({ openFilterModal });
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Add filter' }));
    expect(openFilterModal).toHaveBeenCalled();
  });

  it('opens the insert palette for columns and weight', () => {
    const openCommandPalette = vi.fn();
    useVelocityStore.setState({
      openCommandPalette,
      tableConfig: { rowVars: ['gender'], colVar: null },
    });
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Add column' }));
    expect(openCommandPalette).toHaveBeenCalledWith('columns');
    fireEvent.click(screen.getByRole('button', { name: '+ Add weight' }));
    expect(openCommandPalette).toHaveBeenCalledWith('weight');
  });

  it('updates comparison method from inspector select', () => {
    const updateAnalysisSettings = vi.fn();
    useVelocityStore.setState({ updateAnalysisSettings });
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.change(screen.getByLabelText('Comparison method'), { target: { value: 'pairwise' } });
    expect(updateAnalysisSettings).toHaveBeenCalledWith({ comparisonMethod: 'pairwise' });
  });

  it('toggles column bases and removes column chip', () => {
    const updateAnalysisSettings = vi.fn();
    const setTableConfig = vi.fn();
    useVelocityStore.setState({ updateAnalysisSettings, setTableConfig });
    render(
      <RecipeInspector
        open
        weightEnabled={false}
        rememberedWeightVar={null}
        onWeightRemove={vi.fn()}
        onToggleWeight={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Show column bases' }));
    expect(updateAnalysisSettings).toHaveBeenCalledWith({ showColumnBases: true });
    fireEvent.click(screen.getByRole('button', { name: 'Remove SEG from columns' }));
    expect(setTableConfig).toHaveBeenCalledWith({ colVar: null });
  });
});
