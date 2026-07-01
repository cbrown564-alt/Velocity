import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WaveTimeline } from './WaveTimeline';
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

const project: Project = {
  id: 'p1',
  name: 'Tracking Study',
  color: '#3498DB',
  datasetIds: ['w1', 'w2'],
  isLongitudinal: true,
  respondentKeyVariable: 'respondent_id',
  createdAt: Date.now(),
};

const makeWave = (id: string, waveNumber: number, rowCount: number, createdAt: number): StoredDataset => ({
  id,
  name: `${id}.sav`,
  fileName: `${id}.sav`,
  rowCount,
  columnCount: 10,
  fileSize: 4096,
  source: 'sav',
  createdAt,
  lastOpenedAt: createdAt,
  lastModifiedAt: createdAt,
  starred: false,
  waveNumber,
});

describe('WaveTimeline', () => {
  it('shows empty state when no waves are configured', () => {
    render(<WaveTimeline project={project} datasets={[]} />);
    expect(screen.getByText(/no waves configured yet/i)).toBeInTheDocument();
  });

  it('renders compact wave nodes and health summary', () => {
    const datasets = [
      makeWave('w1', 1, 1000, Date.now() - 86400000 * 60),
      makeWave('w2', 2, 850, Date.now() - 86400000 * 30),
    ];

    render(<WaveTimeline project={project} datasets={datasets} />);

    expect(screen.getByTestId('wave-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('wave-node-2')).toBeInTheDocument();
    expect(screen.getByText(/85% retained/i)).toBeInTheDocument();
  });

  it('calls onWaveClick when a compact wave node is clicked', () => {
    const onWaveClick = vi.fn();
    const datasets = [makeWave('w1', 1, 500, Date.now())];

    render(<WaveTimeline project={project} datasets={datasets} onWaveClick={onWaveClick} />);

    fireEvent.click(screen.getByTestId('wave-node-1'));
    expect(onWaveClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }));
  });

  it('renders detailed timeline with compare action', () => {
    const onCompareWaves = vi.fn();
    const datasets = [
      makeWave('w1', 1, 1000, Date.now() - 86400000 * 60),
      makeWave('w2', 2, 800, Date.now() - 86400000 * 30),
    ];

    render(<WaveTimeline project={project} datasets={datasets} detailed onCompareWaves={onCompareWaves} />);

    expect(screen.getByText(/panel health/i)).toBeInTheDocument();
    expect(screen.getByText(/respondent_id/i)).toBeInTheDocument();

    const compareBtn = screen.getByTitle(/compare wave 1 to wave 2/i);
    fireEvent.click(compareBtn);
    expect(onCompareWaves).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w1' }),
      expect.objectContaining({ id: 'w2' }),
    );
  });
});
