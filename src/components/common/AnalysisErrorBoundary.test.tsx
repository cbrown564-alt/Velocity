import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisErrorBoundary } from './AnalysisErrorBoundary';

function ThrowOnRender({ message = 'boom' }: { message?: string }): React.ReactNode {
  throw new Error(message);
}

function SafeShell() {
  return <div data-testid="dashboard-shell">Dashboard shell</div>;
}

describe('AnalysisErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('catches render errors and shows a recoverable fallback', () => {
    render(
      <>
        <SafeShell />
        <AnalysisErrorBoundary surface="table" slideId="slide-1">
          <ThrowOnRender />
        </AnalysisErrorBoundary>
      </>,
    );

    expect(screen.getByTestId('dashboard-shell')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("This table couldn't render");
    expect(screen.getByText('Slide: slide-1')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('retries after the user clicks Retry', () => {
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error('first failure');
      return <div data-testid="analysis-ok">Rendered</div>;
    }

    const onRetry = vi.fn(() => {
      shouldThrow = false;
    });

    render(
      <AnalysisErrorBoundary surface="chart" onRetry={onRetry}>
        <MaybeThrow />
      </AnalysisErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent("This chart couldn't render");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('analysis-ok')).toBeInTheDocument();
  });

  it('clears the error when resetKey changes', () => {
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error('stale failure');
      return <div data-testid="analysis-ok">Rendered</div>;
    }

    const { rerender } = render(
      <AnalysisErrorBoundary surface="table" resetKey="config-a">
        <MaybeThrow />
      </AnalysisErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    rerender(
      <AnalysisErrorBoundary surface="table" resetKey="config-b">
        <MaybeThrow />
      </AnalysisErrorBoundary>,
    );

    expect(screen.getByTestId('analysis-ok')).toBeInTheDocument();
  });
});
