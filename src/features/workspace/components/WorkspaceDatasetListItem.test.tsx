import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceDatasetListItem } from './WorkspaceDatasetListItem';
import type { StoredDataset } from '../types';

const mockDataset: StoredDataset = {
  id: 'ds-1',
  name: 'survey_2024.sav',
  fileName: 'survey_2024.sav',
  rowCount: 1000,
  columnCount: 30,
  fileSize: 20480,
  source: 'sav',
  createdAt: Date.now() - 86400000,
  lastOpenedAt: Date.now() - 3600000,
  lastModifiedAt: Date.now() - 3600000,
  starred: false,
};

describe('WorkspaceDatasetListItem', () => {
  it('renders dataset name', () => {
    render(
      <WorkspaceDatasetListItem
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={vi.fn()}
      />,
    );
    expect(screen.getByText('survey_2024.sav')).toBeInTheDocument();
  });

  it('calls onOpen when Enter key is pressed', () => {
    const onOpen = vi.fn();
    render(
      <WorkspaceDatasetListItem
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={onOpen}
        onToggleStar={vi.fn()}
      />,
    );

    const item = screen.getByRole('button', { name: /open dataset survey_2024\.sav/i });
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onOpen when Space key is pressed', () => {
    const onOpen = vi.fn();
    render(
      <WorkspaceDatasetListItem
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={onOpen}
        onToggleStar={vi.fn()}
      />,
    );

    const item = screen.getByRole('button', { name: /open dataset survey_2024\.sav/i });
    fireEvent.keyDown(item, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleStar when star button is clicked', () => {
    const onToggleStar = vi.fn();
    render(
      <WorkspaceDatasetListItem
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={onToggleStar}
      />,
    );

    // The native <button> element for the star (not the motion.div with role="button")
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    expect(onToggleStar).toHaveBeenCalledTimes(1);
  });

  it('shows session indicator for dataset with sessionState', () => {
    const datasetWithSession: StoredDataset = {
      ...mockDataset,
      sessionState: { tableConfig: { rowVars: ['a'], colVar: null }, activeFilters: [], transformLog: [] },
    };
    const { container } = render(
      <WorkspaceDatasetListItem
        dataset={datasetWithSession}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={vi.fn()}
      />,
    );
    // Session dot should be present (Sparkles icon or title)
    expect(container.querySelector('[title="Session saved"]')).toBeInTheDocument();
  });

  it('shows project badge when project is provided', () => {
    render(
      <WorkspaceDatasetListItem
        dataset={mockDataset}
        project={{
          id: 'p1',
          name: 'Brand Tracker',
          color: '#blue',
          isLongitudinal: false,
          datasetIds: [],
          createdAt: Date.now(),
        }}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={vi.fn()}
      />,
    );
    expect(screen.getByText('Brand Tracker')).toBeInTheDocument();
  });
});
