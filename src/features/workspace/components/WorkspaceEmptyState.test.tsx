import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      fireEvent.click(screen.getByText('Upload .SAV or .CSV'));
      expect(onUpload).toHaveBeenCalledTimes(1);
    });

    it('calls onLoadExample when example action is clicked', () => {
      const onLoadExample = vi.fn();
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={onLoadExample} />);
      fireEvent.click(screen.getByText('Load example dataset'));
      expect(onLoadExample).toHaveBeenCalledTimes(1);
    });
  });

  describe('first-run Workshop Door', () => {
    it('renders outcome-focused hero copy', () => {
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/client SAV to editable deck/i);
      expect(screen.getByText(/Weighted crosstabs with significance/i)).toBeInTheDocument();
      expect(screen.getByText('Upload client .SAV')).toBeInTheDocument();
      expect(screen.getByText('Walk through example (~2 min)')).toBeInTheDocument();
    });

    it('shows workflow steps', () => {
      render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun />);
      expect(screen.getByText('Load .sav')).toBeInTheDocument();
      expect(screen.getByText('Crosstab')).toBeInTheDocument();
      expect(screen.getByText('Export PPTX')).toBeInTheDocument();
    });

    it('calls handlers from first-run CTAs', () => {
      const onUpload = vi.fn();
      const onLoadExample = vi.fn();
      render(<WorkspaceEmptyState onUpload={onUpload} onLoadExample={onLoadExample} isFirstRun />);
      fireEvent.click(screen.getByText('Upload client .SAV'));
      fireEvent.click(screen.getByText('Walk through example (~2 min)'));
      expect(onUpload).toHaveBeenCalledTimes(1);
      expect(onLoadExample).toHaveBeenCalledTimes(1);
    });

    it('shows import session link when provided', () => {
      const onImportSession = vi.fn();
      render(
        <WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} isFirstRun onImportSession={onImportSession} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /import a \.velocity session/i }));
      expect(onImportSession).toHaveBeenCalledTimes(1);
    });
  });
});
