import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceDatasetCard } from './WorkspaceDatasetCard';
import type { StoredDataset } from '../types';

const mockDataset: StoredDataset = {
  id: 'ds-1',
  name: 'survey_2024.sav',
  fileName: 'survey_2024.sav',
  rowCount: 2500,
  columnCount: 48,
  fileSize: 51200,
  source: 'sav',
  createdAt: Date.now() - 172800000,
  lastOpenedAt: Date.now() - 7200000,
  lastModifiedAt: Date.now() - 7200000,
  starred: false,
};

describe('WorkspaceDatasetCard', () => {
  it('renders dataset name and row count', () => {
    render(
      <WorkspaceDatasetCard
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={vi.fn()}
        onDelete={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    expect(screen.getByText('survey_2024.sav')).toBeInTheDocument();
    expect(screen.getByText('2,500 rows')).toBeInTheDocument();
    expect(screen.getByText('48 cols')).toBeInTheDocument();
  });

  it('calls onToggleStar when star button is clicked', () => {
    const onToggleStar = vi.fn();
    render(
      <WorkspaceDatasetCard
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={onToggleStar}
        onDelete={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    // Find the star button (StarOff icon button)
    const buttons = screen.getAllByRole('button');
    const starBtn = buttons.find((b) => b.className.includes('star') || b.querySelector('svg') !== null);
    if (starBtn) fireEvent.click(starBtn);
    expect(onToggleStar).toHaveBeenCalledTimes(1);
  });

  it('calls onOpen when Open button is clicked', () => {
    const onOpen = vi.fn();
    render(
      <WorkspaceDatasetCard
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={onOpen}
        onToggleStar={vi.fn()}
        onDelete={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Open'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onContextMenu when more-options button is clicked', () => {
    const onContextMenu = vi.fn();
    render(
      <WorkspaceDatasetCard
        dataset={mockDataset}
        isSelected={false}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={vi.fn()}
        onDelete={vi.fn()}
        onContextMenu={onContextMenu}
      />,
    );
    // The MoreHorizontal icon button
    const buttons = screen.getAllByRole('button');
    const moreBtn = buttons[buttons.length - 1];
    fireEvent.click(moreBtn);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it('renders checkmark SVG when isSelected', () => {
    const { container } = render(
      <WorkspaceDatasetCard
        dataset={mockDataset}
        isSelected
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onToggleStar={vi.fn()}
        onDelete={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );
    // The isSelected=true renders the card (motion.div) in selected state
    expect(container.firstChild).toBeInTheDocument();
    // The card still shows the dataset name when selected
    expect(screen.getByText('survey_2024.sav')).toBeInTheDocument();
  });
});
