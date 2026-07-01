import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatasetSidebar from './DatasetSidebar';
import type { StoredDataset } from '../types';

const makeDataset = (id: string, overrides: Partial<StoredDataset> = {}): StoredDataset => ({
  id,
  name: `${id}.sav`,
  fileName: `${id}.sav`,
  rowCount: 500,
  columnCount: 20,
  fileSize: 10240,
  source: 'sav',
  createdAt: Date.now() - 86400000,
  lastOpenedAt: Date.now() - 3600000,
  lastModifiedAt: Date.now() - 3600000,
  starred: false,
  ...overrides,
});

describe('DatasetSidebar', () => {
  it('renders in collapsed mode', () => {
    const { container } = render(
      <DatasetSidebar
        isExpanded={false}
        onToggleExpand={vi.fn()}
        datasets={[makeDataset('survey_2024')]}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('renders dataset names in expanded mode', () => {
    render(
      <DatasetSidebar
        isExpanded
        onToggleExpand={vi.fn()}
        datasets={[makeDataset('survey_2024'), makeDataset('tracker_wave1')]}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    expect(screen.getByText('survey_2024.sav')).toBeInTheDocument();
    expect(screen.getByText('tracker_wave1.sav')).toBeInTheDocument();
  });

  it('calls onSelectDataset when dataset is clicked', () => {
    const onSelectDataset = vi.fn();
    const dataset = makeDataset('survey_2024');
    render(
      <DatasetSidebar
        isExpanded
        onToggleExpand={vi.fn()}
        datasets={[dataset]}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={onSelectDataset}
        onOpenWorkspace={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('survey_2024.sav'));
    expect(onSelectDataset).toHaveBeenCalledWith(dataset);
  });

  it('calls onToggleExpand when toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <DatasetSidebar
        isExpanded
        onToggleExpand={onToggle}
        datasets={[]}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    const toggleBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onUpload when Upload button is clicked', () => {
    const onUpload = vi.fn();
    render(
      <DatasetSidebar
        isExpanded
        onToggleExpand={vi.fn()}
        datasets={[]}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onUpload={onUpload}
      />,
    );
    fireEvent.click(screen.getByTitle('Upload new dataset'));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenWorkspace when Workspace button is clicked', () => {
    const onOpenWorkspace = vi.fn();
    render(
      <DatasetSidebar
        isExpanded
        onToggleExpand={vi.fn()}
        datasets={[]}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={vi.fn()}
        onOpenWorkspace={onOpenWorkspace}
        onUpload={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Open workspace'));
    expect(onOpenWorkspace).toHaveBeenCalledTimes(1);
  });

  it('shows +N indicator when collapsed with more than 6 datasets', () => {
    const datasets = Array.from({ length: 10 }, (_, i) => makeDataset(`ds-${i}`));
    render(
      <DatasetSidebar
        isExpanded={false}
        onToggleExpand={vi.fn()}
        datasets={datasets}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('shows relative time labels in expanded mode (covers formatRelativeTime)', () => {
    const now = Date.now();
    const datasets = [
      makeDataset('recent', { lastOpenedAt: now - 30000 }), // 30 seconds ago → "now"
      makeDataset('minutes', { lastOpenedAt: now - 5 * 60 * 1000 }), // 5 min → "5m"
    ];
    const { container } = render(
      <DatasetSidebar
        isExpanded
        onToggleExpand={vi.fn()}
        datasets={datasets}
        projects={[]}
        activeDatasetId={null}
        onSelectDataset={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    // The timestamps are rendered inside dataset items
    expect(container.textContent).toMatch(/now|5m/);
  });
});
