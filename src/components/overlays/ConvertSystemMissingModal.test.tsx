import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConvertSystemMissingModal } from './ConvertSystemMissingModal';

const noop = vi.fn();

describe('ConvertSystemMissingModal', () => {
  it('renders title and input fields when open', () => {
    render(
      <ConvertSystemMissingModal
        isOpen
        onClose={noop}
        onSubmit={noop}
        initialCode={999}
        initialLabel="System missing"
        title="Convert System Missing"
      />,
    );

    expect(screen.getByText('Convert System Missing')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. 999/)).toBeInTheDocument();
  });

  it('updates code input on change', () => {
    render(<ConvertSystemMissingModal isOpen onClose={noop} onSubmit={noop} initialCode={999} />);

    const codeInput = screen.getByPlaceholderText(/e\.g\. 999/);
    fireEvent.change(codeInput, { target: { value: '88' } });
    expect(codeInput).toHaveValue(88);
  });

  it('updates label input on change', () => {
    render(<ConvertSystemMissingModal isOpen onClose={noop} onSubmit={noop} initialCode={999} />);

    const labelInput = screen.getByPlaceholderText('Recovered from system missing');
    fireEvent.change(labelInput, { target: { value: 'Not applicable' } });
    expect(labelInput).toHaveValue('Not applicable');
  });

  it('calls onSubmit with code and label when form is submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <ConvertSystemMissingModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        initialCode={999}
        initialLabel="Missing"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ code: 999, label: 'Missing' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables submit button when label is empty', () => {
    const onSubmit = vi.fn();
    render(
      <ConvertSystemMissingModal isOpen onClose={noop} onSubmit={onSubmit} initialCode={999} initialLabel="Missing" />,
    );

    const labelInput = screen.getByPlaceholderText('Recovered from system missing');
    fireEvent.change(labelInput, { target: { value: '' } });
    const submitBtn = screen.getByRole('button', { name: 'Convert' });
    expect(submitBtn).toBeDisabled();
  });

  it('shows label validation error when form submitted with empty label', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ConvertSystemMissingModal isOpen onClose={noop} onSubmit={onSubmit} initialCode={999} initialLabel="Missing" />,
    );

    const labelInput = screen.getByPlaceholderText('Recovered from system missing');
    fireEvent.change(labelInput, { target: { value: '' } });
    const form = container.querySelector('form');
    if (form) fireEvent.submit(form);
    expect(await screen.findByText(/label is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ConvertSystemMissingModal isOpen onClose={onClose} onSubmit={noop} initialCode={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error from rejected onSubmit promise', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Conversion failed'));
    render(<ConvertSystemMissingModal isOpen onClose={noop} onSubmit={onSubmit} initialCode={999} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByText('Conversion failed')).toBeInTheDocument();
  });
});
