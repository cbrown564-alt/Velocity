import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputModal } from './InputModal';

describe('InputModal', () => {
  it('submits trimmed value and closes', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(<InputModal isOpen onClose={onClose} onSubmit={onSubmit} title="Rename" initialValue="Old name" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  New name  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onSubmit).toHaveBeenCalledWith('New name');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not submit empty values', () => {
    const onSubmit = vi.fn();
    render(<InputModal isOpen onClose={vi.fn()} onSubmit={onSubmit} title="Rename" initialValue="" />);

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<InputModal isOpen onClose={onClose} onSubmit={vi.fn()} title="Rename" initialValue="x" />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
