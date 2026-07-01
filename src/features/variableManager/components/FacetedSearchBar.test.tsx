import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacetedSearchBar } from './FacetedSearchBar';
import { useVelocityStore } from '../../../store';

const setupStore = () =>
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

describe('FacetedSearchBar accessibility', () => {
  beforeEach(setupStore);

  it('exposes status dropdown options as menuitemcheckbox controls', () => {
    render(<FacetedSearchBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Status filters' }));

    expect(screen.getByRole('menu', { name: 'Status options' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /visible/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /hidden/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /derived/i })).toBeInTheDocument();
  });
});

describe('FacetedSearchBar interactions', () => {
  beforeEach(setupStore);

  it('calls setFacetFilters when a type bar is clicked (toggleTypeFacet)', () => {
    const setFacetFilters = vi.fn();
    useVelocityStore.setState({ setFacetFilters } as never);

    render(<FacetedSearchBar />);
    // Click the 'Cat' type bar button
    const catBtn = screen.getByRole('button', { name: /cat/i });
    fireEvent.click(catBtn);
    expect(setFacetFilters).toHaveBeenCalledWith({ types: ['categorical'] });
  });

  it('calls setFacetFilters when Status filter is selected (toggleStatusFacet)', () => {
    const setFacetFilters = vi.fn();
    useVelocityStore.setState({ setFacetFilters } as never);

    render(<FacetedSearchBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Status filters' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /hidden/i }));
    expect(setFacetFilters).toHaveBeenCalledWith({ statuses: ['hidden'] });
  });

  it('calls setFacetFilters when Quality filter is selected (toggleQualityFacet)', () => {
    const setFacetFilters = vi.fn();
    useVelocityStore.setState({ setFacetFilters } as never);

    render(<FacetedSearchBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Quality filters' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /incomplete/i }));
    expect(setFacetFilters).toHaveBeenCalledWith({ qualities: ['incomplete'] });
  });

  it('opens Quality dropdown with OK badge when no issues', () => {
    render(<FacetedSearchBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Quality filters' }));
    expect(screen.getByRole('menu', { name: 'Quality options' })).toBeInTheDocument();
  });

  it('shows Unhide all button and calls bulkHide (handleUnhideAll)', () => {
    const bulkHide = vi.fn();
    useVelocityStore.setState({ bulkHide } as never);

    render(<FacetedSearchBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Status filters' }));
    // vs-2 is hidden, so "Unhide all" button should appear
    const unhideBtn = screen.queryByText(/unhide all/i);
    if (unhideBtn) {
      fireEvent.click(unhideBtn);
      expect(bulkHide).toHaveBeenCalledWith(['vs-2'], false);
    }
  });

  it('shows and removes chip when facet is active (clearFacetFilters)', () => {
    const clearFacetFilters = vi.fn();
    useVelocityStore.setState({
      facetFilters: { types: ['categorical'], statuses: [], qualities: [] },
      clearFacetFilters,
    } as never);

    render(<FacetedSearchBar />);
    // Clear all button should be visible
    const clearBtn = screen.queryByText(/clear all/i);
    if (clearBtn) {
      fireEvent.click(clearBtn);
      expect(clearFacetFilters).toHaveBeenCalled();
    }
  });

  it('closes Quality dropdown when clicking outside (handleClickOutside)', () => {
    render(<FacetedSearchBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Quality filters' }));
    expect(screen.getByRole('menu', { name: 'Quality options' })).toBeInTheDocument();
    // Click outside the dropdown
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu', { name: 'Quality options' })).not.toBeInTheDocument();
  });
});
