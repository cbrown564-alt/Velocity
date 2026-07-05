import React from 'react';
import { describe, expect, it, beforeAll, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PersistenceStatus } from './PersistenceStatus';

const noop = () => {};

beforeAll(() => {
  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    }));
  }
});

const baseProps = {
  mode: 'opfs' as const,
  opfsAvailable: true,
  dbLabel: 'velocity.db',
  usageMb: 10,
  quotaMb: 100,
  usagePct: 10,
  error: null as string | null,
  errorHint: null as string | null,
  rehydrateError: null as string | null,
  memoryRisk: 'normal' as const,
  partialLoadMessage: null as string | null,
  opfsFileKey: undefined as string | undefined,
  onRefresh: noop,
  onPurge: noop,
  onRebuild: noop,
};

describe('PersistenceStatus', () => {
  it('requires confirmation before purging corruption', () => {
    const onPurge = vi.fn();
    render(
      <PersistenceStatus
        {...baseProps}
        error="Database file appears corrupted"
        opfsFileKey="dataset-key"
        onPurge={onPurge}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /purge corruption/i }));

    expect(screen.getByText('Purge corrupted storage?')).toBeInTheDocument();
    expect(onPurge).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^purge$/i }));

    expect(onPurge).toHaveBeenCalledTimes(1);
  });

  it('shows elevated memory risk in the status label', () => {
    render(<PersistenceStatus {...baseProps} memoryRisk="elevated" />);
    expect(screen.getByText('Memory Risk')).toBeInTheDocument();
  });

  it('opens details modal with diagnostics and rebuild action', () => {
    const onRebuild = vi.fn();
    render(
      <PersistenceStatus
        {...baseProps}
        opfsFileKey="dataset-key"
        datasetRows={1200}
        datasetColumns={40}
        estimatedCells={48000}
        labeledVariableCount={30}
        totalVariableCount={40}
        totalValueLabelCount={120}
        memoryRisk="critical"
        onRebuild={onRebuild}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Storage Health')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText(/1,200/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /re-import original file/i }));
    expect(onRebuild).toHaveBeenCalledTimes(1);
  });

  it('shows partial load messaging and refresh action', () => {
    const onRefresh = vi.fn();
    render(
      <PersistenceStatus
        {...baseProps}
        partialLoadMessage="Some value labels were dropped during import"
        errorHint="Try re-importing the source file"
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/partial metadata/i)).toBeInTheDocument();
  });
});
