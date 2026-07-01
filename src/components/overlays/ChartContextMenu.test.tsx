import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartContextMenu } from './ChartContextMenu';

const noop = vi.fn();

describe('ChartContextMenu', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ChartContextMenu
        isOpen={false}
        position={{ x: 100, y: 100 }}
        options={[{ label: 'Edit', onClick: noop }]}
        onClose={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders options when open', () => {
    render(
      <ChartContextMenu
        isOpen
        position={{ x: 100, y: 200 }}
        title="Chart Options"
        subtitle="Gender × Region"
        options={[
          { label: 'Edit', onClick: noop },
          { label: 'Delete', onClick: noop, danger: true },
        ]}
        onClose={noop}
      />,
    );

    expect(screen.getByText('Chart Options')).toBeInTheDocument();
    expect(screen.getByText('Gender × Region')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls option onClick and onClose when option clicked', () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    render(
      <ChartContextMenu
        isOpen
        position={{ x: 10, y: 10 }}
        options={[{ label: 'Edit', onClick: onEdit }]}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking outside the menu', () => {
    const onClose = vi.fn();
    render(
      <ChartContextMenu
        isOpen
        position={{ x: 10, y: 10 }}
        options={[{ label: 'Edit', onClick: noop }]}
        onClose={onClose}
      />,
    );

    fireEvent.click(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});
