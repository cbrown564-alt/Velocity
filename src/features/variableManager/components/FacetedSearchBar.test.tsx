import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacetedSearchBar } from './FacetedSearchBar';
import { useVelocityStore } from '../../../store';

describe('FacetedSearchBar accessibility', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      variableSets: [
        {
          id: 'vs-1',
          name: 'Gender',
          variableIds: ['gender'],
          structure: 'single',
          type: 'categorical',
          hidden: false,
        },
        { id: 'vs-2', name: 'Region', variableIds: ['region'], structure: 'single', type: 'categorical', hidden: true },
      ],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 10,
        source: 'csv',
        variables: [
          { id: 'gender', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} },
          { id: 'region', name: 'region', label: 'Region', type: 'categorical', valueLabels: [], missingValues: {} },
        ],
      },
      activeFolderId: null,
      managerSearchQuery: '',
      facetFilters: { types: [], statuses: [], qualities: [] },
      setFacetFilters: vi.fn(),
      clearFacetFilters: vi.fn(),
      variableStats: {},
      bulkHide: vi.fn(),
    } as never);
  });

  it('exposes status dropdown options as menuitemcheckbox controls', () => {
    render(<FacetedSearchBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Status filters' }));

    expect(screen.getByRole('menu', { name: 'Status options' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /visible/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /hidden/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /derived/i })).toBeInTheDocument();
  });
});
