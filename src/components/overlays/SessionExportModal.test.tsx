import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionExportModal } from './SessionExportModal';
import type { SessionExportSummary } from './sessionModalTypes';

const baseSummary: SessionExportSummary = {
  datasetName: 'survey_2024.sav',
  rowCount: 1500,
  columnCount: 42,
  recodeCount: 3,
  slideCount: 7,
  filterCount: 2,
  sectionCount: 4,
};

describe('SessionExportModal', () => {
  it('renders summary info when open', () => {
    render(
      <SessionExportModal
        isOpen
        onClose={vi.fn()}
        onExport={vi.fn().mockResolvedValue(undefined)}
        summary={baseSummary}
      />,
    );

    expect(screen.getByText('Export Session')).toBeInTheDocument();
    expect(screen.getByText('survey_2024.sav')).toBeInTheDocument();
    expect(screen.getByText(/1,500 rows/)).toBeInTheDocument();
    expect(screen.getByText(/3 recoded variables/)).toBeInTheDocument();
    expect(screen.getByText(/7 analysis slides/)).toBeInTheDocument();
    expect(screen.getByText(/2 active filters/)).toBeInTheDocument();
    expect(screen.getByText(/4 slide sections/)).toBeInTheDocument();
  });

  it('omits zero-count items from summary', () => {
    render(
      <SessionExportModal
        isOpen
        onClose={vi.fn()}
        onExport={vi.fn().mockResolvedValue(undefined)}
        summary={{ ...baseSummary, recodeCount: 0, filterCount: 0, sectionCount: 0 }}
      />,
    );

    expect(screen.queryByText(/recoded variable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/active filter/)).not.toBeInTheDocument();
    expect(screen.queryByText(/slide section/)).not.toBeInTheDocument();
  });

  it('uses singular form for count of 1', () => {
    render(
      <SessionExportModal
        isOpen
        onClose={vi.fn()}
        onExport={vi.fn().mockResolvedValue(undefined)}
        summary={{ ...baseSummary, recodeCount: 1, slideCount: 1, filterCount: 1, sectionCount: 1 }}
      />,
    );

    expect(screen.getByText('1 recoded variable')).toBeInTheDocument();
    expect(screen.getByText('1 analysis slide')).toBeInTheDocument();
    expect(screen.getByText('1 active filter')).toBeInTheDocument();
    expect(screen.getByText('1 slide section')).toBeInTheDocument();
  });

  it('calls onExport when Download button is clicked', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<SessionExportModal isOpen onClose={onClose} onExport={onExport} summary={baseSummary} />);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: /downloaded/i })).toBeInTheDocument());
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <SessionExportModal
        isOpen
        onClose={onClose}
        onExport={vi.fn().mockResolvedValue(undefined)}
        summary={baseSummary}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when export is in progress', () => {
    let resolveExport: () => void;
    const onExport = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveExport = resolve;
      }),
    );
    const onClose = vi.fn();
    render(<SessionExportModal isOpen onClose={onClose} onExport={onExport} summary={baseSummary} />);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    // Try to close while exporting
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(onClose).not.toHaveBeenCalled();
    resolveExport!();
  });

  it('renders nothing when closed', () => {
    render(
      <SessionExportModal
        isOpen={false}
        onClose={vi.fn()}
        onExport={vi.fn().mockResolvedValue(undefined)}
        summary={baseSummary}
      />,
    );
    expect(screen.queryByText('Export Session')).not.toBeInTheDocument();
  });
});
