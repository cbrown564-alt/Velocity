import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

describe('WorkspaceEmptyState', () => {
  it('renders welcome heading', () => {
    render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} />);
    expect(screen.getByText('Welcome to Velocity')).toBeInTheDocument();
  });

  it('calls onUpload when Upload Dataset is clicked', () => {
    const onUpload = vi.fn();
    render(<WorkspaceEmptyState onUpload={onUpload} onLoadExample={vi.fn()} />);
    fireEvent.click(screen.getByText('Upload Dataset'));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('calls onLoadExample when Load Example is clicked', () => {
    const onLoadExample = vi.fn();
    render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={onLoadExample} />);
    fireEvent.click(screen.getByText('Load Example'));
    expect(onLoadExample).toHaveBeenCalledTimes(1);
  });

  it('shows Upload Dataset and Load Example actions', () => {
    render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} />);
    expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
    expect(screen.getByText('Load Example')).toBeInTheDocument();
    expect(screen.getByText('.SAV or .CSV')).toBeInTheDocument();
  });
});
