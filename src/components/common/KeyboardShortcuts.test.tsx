import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { useVelocityStore } from '../../store';

beforeEach(() => {
  useVelocityStore.setState({
    shortcutsOpen: true,
    closeShortcuts: vi.fn(() => useVelocityStore.setState({ shortcutsOpen: false })),
  } as any);
});

describe('KeyboardShortcuts', () => {
  it('renders Story rail group when open', () => {
    render(<KeyboardShortcuts />);
    expect(screen.getByText('Story rail')).toBeInTheDocument();
    expect(screen.getByText('Insert palette')).toBeInTheDocument();
  });
});
