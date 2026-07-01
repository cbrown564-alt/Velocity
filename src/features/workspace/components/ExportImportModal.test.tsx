import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportImportModal } from './ExportImportModal';
import type { WorkspaceState } from '../types';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

// Mock browser APIs needed for export/import
beforeAll(() => {
  Object.defineProperty(globalThis, 'URL', {
    value: {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    },
    writable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

const workspaceState: WorkspaceState = {
  datasets: [
    {
      id: 'ds-1',
      name: 'survey.sav',
      fileName: 'survey.sav',
      rowCount: 1000,
      columnCount: 30,
      fileSize: 20480,
      source: 'sav',
      createdAt: Date.now() - 86400000,
      lastOpenedAt: Date.now() - 3600000,
      lastModifiedAt: Date.now() - 3600000,
      starred: false,
    },
  ],
  projects: [],
  storageUsed: 1024,
  storageQuota: 1024 * 1024,
};

describe('ExportImportModal', () => {
  it('renders export & import modal header', () => {
    render(<ExportImportModal isOpen onClose={vi.fn()} workspaceState={workspaceState} onImport={vi.fn()} />);
    expect(screen.getByText('Export & Import')).toBeInTheDocument();
    expect(screen.getByText('Export Preview')).toBeInTheDocument();
  });

  it('shows export content by default', () => {
    render(<ExportImportModal isOpen onClose={vi.fn()} workspaceState={workspaceState} onImport={vi.fn()} />);
    expect(screen.getByText('Download JSON')).toBeInTheDocument();
  });

  it('shows import content when Import tab is clicked', () => {
    render(<ExportImportModal isOpen onClose={vi.fn()} workspaceState={workspaceState} onImport={vi.fn()} />);
    const importBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Import'));
    if (importBtn) fireEvent.click(importBtn);
    // The import tab shows dropzone with file select prompt
    expect(screen.getByText('Select a workspace file')).toBeInTheDocument();
  });

  it('shows dataset count in export preview', () => {
    render(<ExportImportModal isOpen onClose={vi.fn()} workspaceState={workspaceState} onImport={vi.fn()} />);
    expect(screen.getByText('1 dataset')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ExportImportModal isOpen onClose={onClose} workspaceState={workspaceState} onImport={vi.fn()} />);
    // The X close button has empty textContent (only SVG icon)
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find((b) => !b.textContent?.trim() || b.textContent?.trim() === '');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    render(<ExportImportModal isOpen={false} onClose={vi.fn()} workspaceState={workspaceState} onImport={vi.fn()} />);
    expect(screen.queryByText('Export & Import')).not.toBeInTheDocument();
  });

  it('calls URL.createObjectURL when Download JSON button is clicked (handleExport)', async () => {
    // Render BEFORE setting up DOM spies to avoid intercepting React mount
    render(<ExportImportModal isOpen onClose={vi.fn()} workspaceState={workspaceState} onImport={vi.fn()} />);
    const downloadBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Download JSON'));
    if (downloadBtn) {
      // Spy on link click AFTER render
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      fireEvent.click(downloadBtn);
      await waitFor(() => {
        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
      });
      clickSpy.mockRestore();
    }
  });

  it('calls clipboard.writeText when Copy to Clipboard is clicked (handleCopyToClipboard)', async () => {
    render(<ExportImportModal isOpen onClose={vi.fn()} workspaceState={workspaceState} onImport={vi.fn()} />);
    const clipboardBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Copy to Clipboard'));
    if (clipboardBtn) {
      fireEvent.click(clipboardBtn);
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    }
  });
});
