import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useVelocityStore } from '../../store';
import { ToastLayer } from './ToastLayer';

describe('ToastLayer', () => {
  beforeEach(() => {
    useVelocityStore.setState({ toasts: [] });
  });

  it('renders nothing when no toasts', () => {
    render(<ToastLayer />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('renders a toast message', () => {
    useVelocityStore.getState().addToast({ message: 'Analysis complete', type: 'success' });
    render(<ToastLayer />);
    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
  });

  it('dismisses a toast when close button clicked', () => {
    useVelocityStore.getState().addToast({ message: 'Dismiss me', type: 'info' });
    render(<ToastLayer />);
    const dismissBtn = screen.getByRole('button', { name: /dismiss notification/i });
    fireEvent.click(dismissBtn);
    expect(useVelocityStore.getState().toasts).toHaveLength(0);
  });

  it('renders multiple toasts', () => {
    useVelocityStore.getState().addToast({ message: 'First', type: 'info' });
    useVelocityStore.getState().addToast({ message: 'Second', type: 'error' });
    render(<ToastLayer />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders optional title above message', () => {
    useVelocityStore.getState().addToast({
      title: 'Saved on this device',
      message: 'Export Session when you need a backup.',
      type: 'info',
    });
    render(<ToastLayer />);
    expect(screen.getByText('Saved on this device')).toBeInTheDocument();
    expect(screen.getByText('Export Session when you need a backup.')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const actionClick = vi.fn();
    useVelocityStore.getState().addToast({
      message: 'Undo available',
      type: 'info',
      action: { label: 'Undo', onClick: actionClick },
    });
    render(<ToastLayer />);
    const actionBtn = screen.getByText('Undo');
    expect(actionBtn).toBeInTheDocument();
    fireEvent.click(actionBtn);
    expect(actionClick).toHaveBeenCalled();
  });
});
