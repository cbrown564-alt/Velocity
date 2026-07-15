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
  const baseProps = {
    engineStatus: 'idle' as const,
    initError: null as string | null,
    persistenceState: 'checking' as const,
    loadProgress: null as null | { phase: 'parsing'; progress: number; message: string },
    workspace: workspaceState,
    dataset: null,
    persistenceError: null as string | null,
    opfsRehydrateError: null as string | null,
    opfsErrorHint: undefined as string | undefined,
    onOpenDataset: async () => {},
    onUploadFile: noop,
    onLoadExample: noop,
    onCreateProject: noop,
    onDeleteDataset: async () => {},
    onToggleStar: noop,
    onLinkDatasets: noop,
    onUnlinkDataset: noop,
    onCompareWaves: noop,
    onBatchStar: noop,
    onBatchDelete: async () => {},
    onExport: noop,
    onImportSession: noop,
    onRebuildFromOpfs: noop,
    onDiscard: noop,
    onRetryEngine: noop,
    onUseMemoryMode: noop,
    onCancelEngineBoot: noop,
  };

  it('keeps first-run workspace actions usable while the engine is idle', () => {
    render(<SplashScreen {...baseProps} persistenceState="idle" />);

    expect(screen.getByTestId('workspace-empty-state')).toBeVisible();
    expect(screen.getByRole('button', { name: /Upload/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Try the brand tracker example/i })).toBeEnabled();
  });

  it('shows initialization phase and progress during engine startup', () => {
    render(
      <SplashScreen
        {...baseProps}
        engineStatus="starting"
        loadProgress={{
          phase: 'parsing',
          progress: 0.42,
          message: 'Parsing metadata',
        }}
      />,
    );

    expect(screen.getByTestId('engine-init-headline')).toHaveTextContent('Parsing variables…');
    expect(screen.getByTestId('engine-init-detail')).toHaveTextContent('Parsing metadata');
    expect(screen.getByTestId('engine-init-detail')).toHaveTextContent('42%');
    expect(screen.getByTestId('engine-init-bar')).toBeInTheDocument();
  });

  it('shows init error in the engine bar', () => {
    const onRetryEngine = vi.fn();
    const onUseMemoryMode = vi.fn();
    render(
      <SplashScreen
        {...baseProps}
        engineStatus="error"
        initError="Worker failed to start"
        onRetryEngine={onRetryEngine}
        onUseMemoryMode={onUseMemoryMode}
      />,
    );

    expect(screen.getByText('Worker failed to start')).toBeInTheDocument();
    expect(screen.queryByTestId('engine-init-headline')).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry engine' }).click();
    screen.getByRole('button', { name: 'Use safe memory mode' }).click();
    expect(onRetryEngine).toHaveBeenCalled();
    expect(onUseMemoryMode).toHaveBeenCalled();
  });

  it('keeps cancellation visible while the engine is starting', () => {
    const onCancelEngineBoot = vi.fn();
    render(<SplashScreen {...baseProps} engineStatus="starting" onCancelEngineBoot={onCancelEngineBoot} />);

    screen.getByRole('button', { name: 'Cancel engine start' }).click();
    expect(onCancelEngineBoot).toHaveBeenCalled();
  });

  it.each([
    ['found', 'Restoring local workspace...'],
    ['restoring', 'Restoring dataset...'],
    ['ready', 'Preparing workspace...'],
    ['corrupt', 'Recovering storage...'],
    ['error', 'Engine initialization failed'],
    ['idle', 'Initializing Analysis Engine...'],
  ] as const)('maps persistence state %s to init headline', (persistenceState, headline) => {
    render(<SplashScreen {...baseProps} engineStatus="starting" persistenceState={persistenceState} />);
    expect(screen.getByTestId('engine-init-headline')).toHaveTextContent(headline);
  });

  it('shows persistence recovery actions when dataset restore fails', () => {
    const onRebuildFromOpfs = vi.fn();
    const onDiscard = vi.fn();

    render(
      <SplashScreen
        {...baseProps}
        dataset={
          {
            id: 'ds-1',
            name: 'sleep.sav',
            opfsFileKey: 'sleep-key',
          } as any
        }
        opfsRehydrateError="OPFS read failed"
        onRebuildFromOpfs={onRebuildFromOpfs}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText("Couldn't restore data from your saved file.")).toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry Restore' }).click();
    screen.getByRole('button', { name: 'Start Fresh' }).click();
    expect(onRebuildFromOpfs).toHaveBeenCalledWith('splash');
    expect(onDiscard).toHaveBeenCalled();
  });

  it('shows persistence error headline when only persistenceError is set', () => {
    render(
      <SplashScreen
        {...baseProps}
        dataset={
          {
            id: 'ds-1',
            name: 'sleep.sav',
            opfsFileKey: 'sleep-key',
          } as any
        }
        persistenceError="quota exceeded"
        opfsErrorHint="Clear browser storage and retry."
      />,
    );

    expect(screen.getByText('Clear browser storage and retry.')).toBeInTheDocument();
    expect(screen.getByText('quota exceeded')).toBeInTheDocument();
  });
});
