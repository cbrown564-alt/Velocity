import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

describe('WorkspaceEmptyState', () => {
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

  it('shows upload and example actions', () => {
    render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} />);
    expect(screen.getByText('Upload .SAV or .CSV')).toBeInTheDocument();
    expect(screen.getByText('Load example dataset')).toBeInTheDocument();
  });
});
