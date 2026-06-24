import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalShell } from './ModalShell';

describe('ModalShell', () => {
  it('renders children when open', () => {
    render(
      <ModalShell isOpen onClose={() => {}}>
        <p>Modal body</p>
      </ModalShell>,
    );

    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('does not render children when closed', () => {
    render(
      <ModalShell isOpen={false} onClose={() => {}}>
        <p>Modal body</p>
      </ModalShell>,
    );

    expect(screen.queryByText('Modal body')).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked (split layout)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ModalShell isOpen onClose={onClose}>
        <p>Modal body</p>
      </ModalShell>,
    );

    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('registers Escape to close when escapeToClose is enabled', () => {
    const onClose = vi.fn();
    render(
      <ModalShell isOpen onClose={onClose} escapeToClose>
        <p>Modal body</p>
      </ModalShell>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns null immediately when unmountWhenClosed and closed', () => {
    const { container } = render(
      <ModalShell isOpen={false} onClose={() => {}} unmountWhenClosed>
        <p>Modal body</p>
      </ModalShell>,
    );

    expect(container.firstChild).toBeNull();
  });
});
