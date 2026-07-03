import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PILOT_LANDING_DROP_LABEL,
  PILOT_LANDING_EXAMPLE_DESC,
  PILOT_LANDING_EXAMPLE_SHORT,
  PILOT_LANDING_EXAMPLE_TITLE,
  PILOT_LANDING_LIBRARY_UPLOAD,
  PILOT_LANDING_UPLOAD_CTA,
} from '../../../constants/pilotCopy';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

describe('WorkspaceEmptyState', () => {
  describe('library empty state', () => {
    it('renders linear-style empty list copy', () => {
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} />);
      expect(screen.getByTestId('workspace-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No datasets yet')).toBeInTheDocument();
    });

    it('calls onUpload when upload action is clicked', () => {
      const onUpload = vi.fn();
      render(<WorkspaceEmptyState onUpload={onUpload} onLoadExample={vi.fn()} />);
      fireEvent.click(screen.getByText(PILOT_LANDING_LIBRARY_UPLOAD));
      expect(onUpload).toHaveBeenCalledTimes(1);
    });

    it('calls onLoadExample when example action is clicked', () => {
      const onLoadExample = vi.fn();
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={onLoadExample} />);
      fireEvent.click(screen.getByText(PILOT_LANDING_EXAMPLE_SHORT));
      expect(onLoadExample).toHaveBeenCalledTimes(1);
    });
  });

  describe('first-run Workshop Door', () => {
    it('renders outcome-focused hero copy', () => {
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/client survey file/i);
      expect(screen.getByText(/Weighted crosstabs with significance/i)).toBeInTheDocument();
      expect(screen.getByText(PILOT_LANDING_UPLOAD_CTA)).toBeInTheDocument();
      expect(screen.getByText(PILOT_LANDING_EXAMPLE_TITLE)).toBeInTheDocument();
      expect(screen.getByText(PILOT_LANDING_EXAMPLE_DESC)).toBeInTheDocument();
    });

    it('shows workflow steps as a visual pipeline', () => {
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun />);
      expect(screen.getByTestId('workflow-strip')).toBeInTheDocument();
      expect(screen.getByText('Import survey')).toBeInTheDocument();
      expect(screen.getByText('Build crosstabs')).toBeInTheDocument();
      expect(screen.getByText('Export deck')).toBeInTheDocument();
      expect(screen.getByText('Supports .sav files')).toBeInTheDocument();
      expect(screen.getByText('Native PowerPoint slides')).toBeInTheDocument();
    });

    it('renders outcome preview and drop zone inside the action panel', () => {
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun onFileDrop={vi.fn()} />);
      expect(screen.getByTestId('workspace-outcome-preview')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-upload-dropzone')).toBeInTheDocument();
      expect(screen.getByText(PILOT_LANDING_DROP_LABEL)).toBeInTheDocument();
      expect(screen.getByText(/what you'll export/i)).toBeInTheDocument();
    });

    it('calls onFileDrop when a valid file is dropped', () => {
      const onFileDrop = vi.fn();
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun onFileDrop={onFileDrop} />);

      const file = new File(['abc'], 'survey.sav', { type: 'application/octet-stream' });
      fireEvent.drop(screen.getByTestId('workspace-upload-dropzone'), {
        dataTransfer: { files: [file] },
      });

      expect(onFileDrop).toHaveBeenCalledWith(file);
    });

    it('calls handlers from first-run CTAs', () => {
      const onUpload = vi.fn();
      const onLoadExample = vi.fn();
      render(<WorkspaceEmptyState onUpload={onUpload} onLoadExample={onLoadExample} isFirstRun />);
      fireEvent.click(screen.getByRole('button', { name: /upload survey file/i }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(PILOT_LANDING_EXAMPLE_TITLE, 'i') }));
      expect(onUpload).toHaveBeenCalledTimes(1);
      expect(onLoadExample).toHaveBeenCalledTimes(1);
    });

    it('shows import session link when provided', () => {
      const onImportSession = vi.fn();
      render(
        <WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun onImportSession={onImportSession} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /import a saved session/i }));
      expect(onImportSession).toHaveBeenCalledTimes(1);
    });
  });
});
