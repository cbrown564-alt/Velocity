import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataSourceColumn } from './DataSourceColumn';
import { useVelocityStore } from '../../store';

describe('DataSourceColumn', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      dataset: null,
      selectedDataSourceId: null,
      setSelectedDataSourceId: vi.fn(),
    });
  });

  it('shows empty state when no dataset is loaded', () => {
    render(<DataSourceColumn />);
    expect(screen.getByText('No data loaded')).toBeInTheDocument();
  });

  it('renders dataset name when dataset is loaded', () => {
    useVelocityStore.setState({
      dataset: {
        id: 'ds-1',
        name: 'survey_2024.sav',
        rowCount: 1000,
        variables: [],
        source: 'sav',
      },
      selectedDataSourceId: null,
      setSelectedDataSourceId: vi.fn(),
    });
    render(<DataSourceColumn />);
    expect(screen.getByText('survey_2024.sav')).toBeInTheDocument();
  });

  it('calls setSelectedDataSourceId when dataset is clicked', () => {
    const setSelectedDataSourceId = vi.fn();
    useVelocityStore.setState({
      dataset: {
        id: 'ds-1',
        name: 'survey_2024.sav',
        rowCount: 1000,
        variables: [],
        source: 'sav',
      },
      selectedDataSourceId: null,
      setSelectedDataSourceId,
    });

    render(<DataSourceColumn />);
    fireEvent.click(screen.getByText('survey_2024.sav'));
    expect(setSelectedDataSourceId).toHaveBeenCalledWith('ds-1');
  });

  it('auto-selects dataset when none is selected', () => {
    const setSelectedDataSourceId = vi.fn();
    useVelocityStore.setState({
      dataset: {
        id: 'ds-1',
        name: 'survey_2024.sav',
        rowCount: 1000,
        variables: [],
        source: 'sav',
      },
      selectedDataSourceId: null,
      setSelectedDataSourceId,
    });

    render(<DataSourceColumn />);
    expect(setSelectedDataSourceId).toHaveBeenCalledWith('ds-1');
  });
});
