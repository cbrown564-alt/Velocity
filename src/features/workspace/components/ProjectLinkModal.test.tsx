import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectLinkModal } from './ProjectLinkModal';
import type { Project, StoredDataset } from '../types';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
}));

const datasets: StoredDataset[] = [
  {
    id: 'ds1',
    name: 'wave1.sav',
    fileName: 'wave1.sav',
    rowCount: 500,
    columnCount: 20,
    fileSize: 8192,
    source: 'sav',
    createdAt: Date.now() - 86400000 * 30,
    lastOpenedAt: Date.now(),
    lastModifiedAt: Date.now(),
    starred: false,
  },
  {
    id: 'ds2',
    name: 'wave2.sav',
    fileName: 'wave2.sav',
    rowCount: 450,
    columnCount: 20,
    fileSize: 8192,
    source: 'sav',
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    lastModifiedAt: Date.now(),
    starred: false,
  },
];

const projects: Project[] = [
  {
    id: 'p-existing',
    name: 'Existing Study',
    color: '#2D4A3E',
    datasetIds: [],
    isLongitudinal: true,
    createdAt: Date.now(),
  },
];

describe('ProjectLinkModal', () => {
  it('creates a longitudinal project with wave assignments', () => {
    const onCreateProject = vi.fn();
    const onUpdateWaveNumber = vi.fn();
    const onSetRespondentKey = vi.fn();
    const onClose = vi.fn();

    render(
      <ProjectLinkModal
        isOpen
        onClose={onClose}
        datasets={datasets}
        projects={[]}
        selectedDatasetIds={['ds1', 'ds2']}
        onCreateProject={onCreateProject}
        onAddToProject={vi.fn()}
        onUpdateWaveNumber={onUpdateWaveNumber}
        onSetRespondentKey={onSetRespondentKey}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/brand tracking/i), {
      target: { value: 'Brand Tracking 2024' },
    });
    const respondentSelect = screen.getAllByRole('combobox').at(-1);
    expect(respondentSelect).toBeDefined();
    fireEvent.change(respondentSelect!, { target: { value: 'panel_id' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(onCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Brand Tracking 2024',
        datasetIds: ['ds1', 'ds2'],
        isLongitudinal: true,
        respondentKeyVariable: 'panel_id',
      }),
    );
    expect(onUpdateWaveNumber).toHaveBeenCalled();
    expect(onSetRespondentKey).toHaveBeenCalledWith('ds1', 'panel_id');
    expect(onClose).toHaveBeenCalled();
  });

  it('adds selected datasets to an existing project', () => {
    const onAddToProject = vi.fn();
    const onClose = vi.fn();

    render(
      <ProjectLinkModal
        isOpen
        onClose={onClose}
        datasets={datasets}
        projects={projects}
        selectedDatasetIds={['ds1']}
        onCreateProject={vi.fn()}
        onAddToProject={onAddToProject}
        onUpdateWaveNumber={vi.fn()}
        onSetRespondentKey={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add to existing/i }));
    fireEvent.click(screen.getByRole('button', { name: /existing study/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to project/i }));

    expect(onAddToProject).toHaveBeenCalledWith(['ds1'], 'p-existing');
    expect(onClose).toHaveBeenCalled();
  });
});
