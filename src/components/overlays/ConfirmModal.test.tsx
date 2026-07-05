import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  it('renders title and message when open', () => {
    render(
      <ConfirmModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete slide"
        message="This cannot be undone."
      />,
    );

    expect(screen.getByText('Delete slide')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm and onClose when confirmed', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmModal isOpen onClose={onClose} onConfirm={onConfirm} title="Confirm" message="Proceed?" />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from cancel', () => {
    const onClose = vi.fn();
    render(<ConfirmModal isOpen onClose={onClose} onConfirm={vi.fn()} title="Confirm" message="Proceed?" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ConfirmModal isOpen onClose={onClose} onConfirm={vi.fn()} title="Confirm" message="Proceed?" />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
