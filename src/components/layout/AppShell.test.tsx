import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { AppShell } from './AppShell';
import { useVelocityStore } from '../../store';

describe('AppShell', () => {
  beforeEach(() => {
    useVelocityStore.setState({ appMode: 'analysis', focusMode: false });
  });

  it('exits focus mode when Variable Manager opens', async () => {
    useVelocityStore.setState({ focusMode: true });
    render(
      <AppShell>
        <div data-testid="child">Child</div>
      </AppShell>,
    );

    // Simulate opening Variable Manager
    await act(async () => {
      useVelocityStore.setState({ appMode: 'variables' });
    });

    // Focus mode should be forced off
    expect(useVelocityStore.getState().focusMode).toBe(false);
  });

  it('renders children', () => {
    const { getByTestId } = render(
      <AppShell>
        <div data-testid="child">Child</div>
      </AppShell>,
    );
    expect(getByTestId('child')).toBeInTheDocument();
  });

  it('toggles Variable Manager on D without requiring a modifier', () => {
    const toggleAppMode = vi.fn();
    useVelocityStore.setState({ appMode: 'analysis', toggleAppMode });
    render(
      <AppShell>
        <div>Child</div>
      </AppShell>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'd' });
    });

    expect(toggleAppMode).toHaveBeenCalledTimes(1);
  });

  it('does not toggle Variable Manager on Ctrl/Cmd+D (reserved for duplicate slide)', () => {
    const toggleAppMode = vi.fn();
    useVelocityStore.setState({ appMode: 'analysis', toggleAppMode });
    render(
      <AppShell>
        <div>Child</div>
      </AppShell>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'd', ctrlKey: true });
    });
    act(() => {
      fireEvent.keyDown(document, { key: 'd', metaKey: true });
    });

    expect(toggleAppMode).not.toHaveBeenCalled();
  });

  it('does not toggle focus mode on F while Variable Manager is open', () => {
    const toggleFocusMode = vi.fn();
    useVelocityStore.setState({ appMode: 'variables', focusMode: false, toggleFocusMode });
    render(
      <AppShell>
        <div>Child</div>
      </AppShell>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'f' });
    });

    expect(toggleFocusMode).not.toHaveBeenCalled();
  });

  it('renders skip link to main content', () => {
    render(
      <AppShell>
        <div>Child</div>
      </AppShell>,
    );

    const skipLink = document.querySelector('.skip-link');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(skipLink).toHaveTextContent('Skip to main content');
  });

  it('hides receded canvas from assistive tech when Variable Manager is open', async () => {
    render(
      <AppShell>
        <div data-testid="child">Child</div>
      </AppShell>,
    );

    await act(async () => {
      useVelocityStore.setState({ appMode: 'variables' });
    });

    const canvas = document.querySelector('[data-testid="analysis-canvas"]');
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    if ('inert' in HTMLElement.prototype) {
      expect((canvas as HTMLElement).inert).toBe(true);
    }
  });
});
