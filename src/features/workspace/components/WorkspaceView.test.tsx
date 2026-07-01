import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceView } from './WorkspaceView';
import type { StoredDataset, WorkspaceState } from '../types';

vi.mock('../../../components/common/ThemeSwitcher', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

vi.mock('../../../components/common/PilotEnvironmentBanner', () => ({
  PilotEnvironmentBanner: () => null,
}));

vi.mock('./WorkspaceStatusStrip', () => ({
  WorkspaceStatusStrip: () => null,
}));

const makeDataset = (id: string, overrides: Partial<StoredDataset> = {}): StoredDataset => ({
  id,
  name: `${id}.sav`,
  fileName: `${id}.sav`,
  rowCount: 250,
  columnCount: 7,
  fileSize: 2048,
  source: 'sav',
  createdAt: Date.now() - 10_000,
  lastOpenedAt: Date.now() - 5_000,
  lastModifiedAt: Date.now() - 5_000,
  starred: false,
  ...overrides,
});

const renderWorkspaceView = (workspaceState: WorkspaceState) =>
  render(
    <WorkspaceView
      workspaceState={workspaceState}
      onOpenDataset={vi.fn()}
      onUploadFile={vi.fn()}
      onLoadExample={vi.fn()}
      onCreateProject={vi.fn()}
      onDeleteDataset={vi.fn()}
      onToggleStar={vi.fn()}
      onLinkDatasets={vi.fn()}
      onUnlinkDataset={vi.fn()}
      onCompareWaves={vi.fn()}
      onBatchStar={vi.fn()}
      onBatchDelete={vi.fn()}
      onExport={vi.fn()}
      onImportSession={vi.fn()}
    />,
  );

describe('WorkspaceView', () => {
  it('shows feedback when starred search has no matches', () => {
    renderWorkspaceView({
      datasets: [makeDataset('alpha', { starred: true })],
      projects: [],
      storageUsed: 0,
      storageQuota: 1024 * 1024,
    });

    fireEvent.click(screen.getByRole('button', { name: /starred/i }));
    fireEvent.change(screen.getByTestId('workspace-search-input'), {
      target: { value: 'no-match-term' },
    });

    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-filter-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no datasets found/i)).toBeInTheDocument();
  });

  it('keeps datasets visible in list view', () => {
    renderWorkspaceView({
      datasets: [makeDataset('mock_data')],
      projects: [],
      storageUsed: 0,
      storageQuota: 1024 * 1024,
    });

    fireEvent.click(screen.getByRole('button', { name: /list view/i }));

    expect(screen.getByRole('button', { name: /open dataset mock_data\.sav/i })).toBeInTheDocument();
    expect(screen.getByText('mock_data.sav')).toBeInTheDocument();
  });
});
