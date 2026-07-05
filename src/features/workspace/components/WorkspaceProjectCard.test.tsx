import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceProjectCard } from './WorkspaceProjectCard';
import type { StoredDataset, Project } from '../types';

const makeDataset = (id: string, wave?: number): StoredDataset => ({
  id,
  name: `wave${id}.sav`,
  fileName: `wave${id}.sav`,
  rowCount: 1000,
  columnCount: 20,
  fileSize: 10240,
  source: 'sav',
  createdAt: Date.now() - 86400000,
  lastOpenedAt: Date.now() - 3600000,
  lastModifiedAt: Date.now() - 3600000,
  starred: false,
  waveNumber: wave,
});

const nonLongProject: Project = {
  id: 'proj-1',
  name: 'Brand Study',
  color: '#6366f1',
  isLongitudinal: false,
  datasetIds: ['ds-1'],
  createdAt: Date.now(),
};

const longProject: Project = {
  id: 'proj-2',
  name: 'Tracker Study',
  color: '#10b981',
  isLongitudinal: true,
  datasetIds: ['ds-1', 'ds-2'],
  createdAt: Date.now(),
};

describe('WorkspaceProjectCard', () => {
  it('renders project name', () => {
    render(<WorkspaceProjectCard project={nonLongProject} datasets={[makeDataset('ds-1')]} onOpenProject={vi.fn()} />);
    expect(screen.getByText('Brand Study')).toBeInTheDocument();
    expect(screen.getByTestId('project-card')).toBeInTheDocument();
  });

  it('calls onOpenProject when project header is clicked', () => {
    const onOpenProject = vi.fn();
    render(
      <WorkspaceProjectCard project={nonLongProject} datasets={[makeDataset('ds-1')]} onOpenProject={onOpenProject} />,
    );
    // Click the project header area
    fireEvent.click(screen.getByText('Brand Study'));
    expect(onOpenProject).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenProject when project header receives Enter key', () => {
    const onOpenProject = vi.fn();
    render(
      <WorkspaceProjectCard project={nonLongProject} datasets={[makeDataset('ds-1')]} onOpenProject={onOpenProject} />,
    );
    const header = screen.getByRole('button', { name: /Open project Brand Study/i });
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(onOpenProject).toHaveBeenCalledTimes(1);
  });

  it('does not show harmonization ring when status is none', () => {
    render(
      <WorkspaceProjectCard
        project={longProject}
        datasets={[makeDataset('ds-1', 1), makeDataset('ds-2', 2)]}
        onOpenProject={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('harmonization-ring')).not.toBeInTheDocument();
  });

  it('shows total row count', () => {
    render(<WorkspaceProjectCard project={nonLongProject} datasets={[makeDataset('ds-1')]} onOpenProject={vi.fn()} />);
    expect(screen.getByText('1,000 total rows')).toBeInTheDocument();
  });

  it('shows expand button for longitudinal project with multiple datasets', () => {
    render(
      <WorkspaceProjectCard
        project={longProject}
        datasets={[makeDataset('ds-1', 1), makeDataset('ds-2', 2)]}
        onOpenProject={vi.fn()}
      />,
    );
    const expandBtn = screen.getByTitle('Show wave details');
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);
  });
});
