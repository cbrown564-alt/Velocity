import React from 'react';
import { describe, expect, it, beforeAll, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PersistenceStatus } from './PersistenceStatus';

const noop = () => {};

beforeAll(() => {
  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', (_query: string) => ({
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

describe('PersistenceStatus', () => {
  it('requires confirmation before purging corruption', () => {
    const onPurge = vi.fn();
    render(
      <PersistenceStatus
        mode="opfs"
        opfsAvailable
        dbLabel="velocity.db"
        usageMb={10}
        quotaMb={100}
        usagePct={10}
        error="Database file appears corrupted"
        errorHint={null}
        rehydrateError={null}
        memoryRisk="normal"
        partialLoadMessage={null}
        opfsFileKey="dataset-key"
        onRefresh={noop}
        onPurge={onPurge}
        onRebuild={noop}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /purge corruption/i }));

    expect(screen.getByText('Purge corrupted storage?')).toBeInTheDocument();
    expect(onPurge).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^purge$/i }));

    expect(onPurge).toHaveBeenCalledTimes(1);
  });
});
