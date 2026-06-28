import React from 'react';
import { describe, expect, it, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplashScreen } from './SplashScreen';
import type { WorkspaceState } from '../../features/workspace';

const noop = () => {};

const workspaceState: WorkspaceState = {
  datasets: [],
  projects: [],
  storageUsed: 0,
  storageQuota: 1024 * 1024,
};

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

describe('SplashScreen', () => {
  it('shows initialization phase and progress during engine startup', () => {
    render(
      <SplashScreen
        isDbReady={false}
        initError={null}
        persistenceState="checking"
        loadProgress={{
          phase: 'parsing',
          progress: 0.42,
          message: 'Parsing metadata',
        }}
        workspace={workspaceState}
        dataset={null}
        persistenceError={null}
        opfsRehydrateError={null}
        opfsErrorHint={undefined}
        onOpenDataset={async () => {}}
        onUploadFile={noop}
        onLoadExample={noop}
        onCreateProject={noop}
        onDeleteDataset={async () => {}}
        onToggleStar={noop}
        onLinkDatasets={noop}
        onUnlinkDataset={noop}
        onCompareWaves={noop}
        onBatchStar={noop}
        onBatchDelete={async () => {}}
        onExport={noop}
        onImportSession={noop}
        onRebuildFromOpfs={noop}
        onDiscard={noop}
      />,
    );

    expect(screen.getByTestId('engine-init-headline')).toHaveTextContent('Parsing variables…');
    expect(screen.getByTestId('engine-init-detail')).toHaveTextContent('Parsing metadata');
    expect(screen.getByTestId('engine-init-progress')).toHaveTextContent('42% complete');
  });
});
