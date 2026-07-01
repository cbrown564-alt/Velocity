import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrossWavePanel } from './CrossWavePanel';
import type { StoredDataset, Project } from '../types';

const makeDataset = (id: string, wave: number, rows = 1000): StoredDataset => ({
  id,
  name: `wave${wave}.sav`,
  fileName: `wave${wave}.sav`,
  rowCount: rows,
  columnCount: 25,
  fileSize: 20480,
  source: 'sav',
  createdAt: Date.now() - 86400000 * wave,
  lastOpenedAt: Date.now() - 3600000,
  lastModifiedAt: Date.now() - 3600000,
  starred: false,
  waveNumber: wave,
});

const project: Project = {
  id: 'proj-long',
  name: 'Longitudinal Tracker',
  color: '#6366f1',
  isLongitudinal: true,
  datasetIds: ['w1', 'w2'],
  createdAt: Date.now(),
};

const wave1 = makeDataset('w1', 1, 1500);
const wave2 = makeDataset('w2', 2, 1200);

describe('CrossWavePanel', () => {
  it('renders nothing when closed', () => {
    render(<CrossWavePanel isOpen={false} onClose={vi.fn()} project={project} datasets={[wave1, wave2]} />);
    expect(screen.queryByText('Cross-Wave Analysis')).not.toBeInTheDocument();
  });

  it('renders panel header when open', () => {
    const { container } = render(
      <CrossWavePanel isOpen onClose={vi.fn()} project={project} datasets={[wave1, wave2]} />,
    );
    expect(screen.getByText('Cross-Wave Analysis')).toBeInTheDocument();
    expect(container.textContent).toContain('Longitudinal Tracker');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<CrossWavePanel isOpen onClose={onClose} project={project} datasets={[wave1, wave2]} />);
    const buttons = screen.getAllByRole('button');
    // The first button with an X icon is the close button
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows wave count', () => {
    const { container } = render(
      <CrossWavePanel isOpen onClose={vi.fn()} project={project} datasets={[wave1, wave2]} />,
    );
    expect(container.textContent).toContain('2 waves');
  });

  it('renders with pre-selected waves', () => {
    render(
      <CrossWavePanel
        isOpen
        onClose={vi.fn()}
        project={project}
        datasets={[wave1, wave2]}
        selectedWaves={[wave1, wave2]}
      />,
    );
    expect(screen.getByText('Cross-Wave Analysis')).toBeInTheDocument();
  });

  it('computes comparison stats when two waves are selected', () => {
    render(<CrossWavePanel isOpen onClose={vi.fn()} project={project} datasets={[wave1, wave2]} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'w1' } });
    fireEvent.change(selects[1], { target: { value: 'w2' } });

    expect(screen.getAllByText(/-20.0%/).length).toBeGreaterThan(0);
  });

  it('calls onOpenHarmonization when harmonize waves is clicked', () => {
    const onOpenHarmonization = vi.fn();
    render(
      <CrossWavePanel
        isOpen
        onClose={vi.fn()}
        project={project}
        datasets={[wave1, wave2]}
        selectedWaves={[wave1, wave2]}
        onOpenHarmonization={onOpenHarmonization}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open harmonization workspace/i }));
    expect(onOpenHarmonization).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w1' }),
      expect.objectContaining({ id: 'w2' }),
    );
  });
});
