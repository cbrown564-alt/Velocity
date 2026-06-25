import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportModal } from './ExportModal';
import { useVelocityStore } from '../../store';

describe('ExportModal accessibility', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      slides: [{ id: 's1', title: 'Slide 1', analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null } }],
      activeSlideId: 's1',
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 10,
        source: 'csv',
        variables: [],
      },
      variableSets: [],
      browserEngine: { runAnalysis: vi.fn() },
      isQuerying: false,
      analysisSettings: {},
    } as never);
  });

  it('exposes export format choices as named radio controls', () => {
    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{ title: 'Report', analyses: [] }}
      />
    );

    expect(screen.getByRole('radiogroup', { name: /export format/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'PowerPoint' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Excel' })).toBeInTheDocument();
  });

  it('blocks export and shows review issues when slide recipes are incomplete', () => {
    useVelocityStore.setState({
      slides: [{
        id: 's1',
        title: 'Broken Slide',
        subtitle: '',
        analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null },
        visualizationType: 'table',
        layoutMode: 'focus',
        cells: [{ id: 'c1', content: { type: 'table' } }],
        createdAt: 1,
        updatedAt: 1,
      }],
      activeSlideId: 's1',
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 10,
        source: 'csv',
        variables: [],
      },
      variableSets: [],
      browserEngine: { runAnalysis: vi.fn() },
      isQuerying: false,
      analysisSettings: {},
    } as never);

    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{ title: 'Report', analyses: [] }}
      />
    );

    expect(screen.getByTestId('export-review-list')).toBeInTheDocument();
    expect(screen.getByText(/add at least one row variable/i)).toBeInTheDocument();
    expect(screen.getByTestId('export-modal-submit')).toBeDisabled();
  });
});
