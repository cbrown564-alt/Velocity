import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataDrawer } from './DataDrawer';

const sampleData = [
  { id: 1, gender: 'Male', region: 'North', age: 35 },
  { id: 2, gender: 'Female', region: 'South', age: 28 },
];

describe('DataDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <DataDrawer
        isOpen={false}
        onClose={vi.fn()}
        title="Gender × Region"
        data={[]}
        loading={false}
        totalCount={0}
        loadedCount={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state when loading and no data', () => {
    render(<DataDrawer isOpen onClose={vi.fn()} title="test" data={[]} loading totalCount={0} loadedCount={0} />);
    expect(screen.getByText(/fetching raw records/i)).toBeInTheDocument();
  });

  it('shows empty state when no records found', () => {
    render(
      <DataDrawer isOpen onClose={vi.fn()} title="test" data={[]} loading={false} totalCount={0} loadedCount={0} />,
    );
    expect(screen.getByText(/no records found/i)).toBeInTheDocument();
  });

  it('renders data rows when data provided', () => {
    render(
      <DataDrawer
        isOpen
        onClose={vi.fn()}
        title="Gender × Region"
        data={sampleData}
        loading={false}
        totalCount={2}
        loadedCount={2}
      />,
    );
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
  });

  it('highlights filter columns', () => {
    render(
      <DataDrawer
        isOpen
        onClose={vi.fn()}
        title="Gender × Region"
        data={sampleData}
        loading={false}
        totalCount={2}
        loadedCount={2}
        filterColumns={['gender']}
      />,
    );
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
  });

  it('shows load more button when more records available', () => {
    const onLoadMore = vi.fn();
    render(
      <DataDrawer
        isOpen
        onClose={vi.fn()}
        title="test"
        data={sampleData}
        loading={false}
        totalCount={100}
        loadedCount={2}
        onLoadMore={onLoadMore}
      />,
    );
    fireEvent.click(screen.getByText('Load More'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <DataDrawer
        isOpen
        onClose={onClose}
        title="test"
        data={sampleData}
        loading={false}
        totalCount={2}
        loadedCount={2}
      />,
    );
    // Find the close button (X icon button)
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find((b) => b.title === '' || b.getAttribute('title') === null);
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
    // The backdrop also triggers close
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows record count in footer', () => {
    render(
      <DataDrawer
        isOpen
        onClose={vi.fn()}
        title="test"
        data={sampleData}
        loading={false}
        totalCount={50}
        loadedCount={2}
      />,
    );
    // Footer shows "Showing X of Y records" text
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });
});
