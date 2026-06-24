import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVelocityStore } from '../../../store';
import { MS_THREE_DAYS } from '../lib/returningResearcher';
import { useWelcomeBack } from './useWelcomeBack';
import type { StoredDataset } from '../components/WorkspaceView';

const makeDataset = (overrides: Partial<StoredDataset> = {}): StoredDataset => ({
  id: 'ds-1',
  name: 'mock_data',
  fileName: 'mock_data.sav',
  rowCount: 100,
  columnCount: 10,
  fileSize: 1024,
  source: 'sav',
  createdAt: Date.now() - 7 * MS_THREE_DAYS,
  lastOpenedAt: Date.now() - MS_THREE_DAYS,
  lastModifiedAt: Date.now() - 3_600_000,
  starred: false,
  sessionState: {
    tableConfig: { rowVars: ['gender'], colVar: 'region' },
    activeFilters: [],
    transformLog: [],
  },
  ...overrides,
});

describe('useWelcomeBack', () => {
  const onOpenDataset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      lastActiveAt: Date.now() - MS_THREE_DAYS - 1,
      welcomeBackDismissed: false,
      activeDatasetId: 'ds-1',
      tableConfig: { rowVars: [], colVar: null },
    });
  });

  it('shows welcome back when datasets exist, user was away, and a resume candidate exists', () => {
    const datasets = [makeDataset()];
    const { result } = renderHook(() => useWelcomeBack({ datasets, onOpenDataset }));

    expect(result.current.showWelcomeBack).toBe(true);
    expect(result.current.resumeCandidate?.datasetId).toBe('ds-1');
  });

  it('hides welcome back when the workspace is empty', () => {
    const { result } = renderHook(() => useWelcomeBack({ datasets: [], onOpenDataset }));

    expect(result.current.showWelcomeBack).toBe(false);
    expect(result.current.resumeCandidate).toBeNull();
  });

  it('hides welcome back when the user dismissed it', () => {
    useVelocityStore.setState({ welcomeBackDismissed: true });
    const datasets = [makeDataset()];
    const { result } = renderHook(() => useWelcomeBack({ datasets, onOpenDataset }));

    expect(result.current.showWelcomeBack).toBe(false);
  });

  it('onResume opens the resume dataset and dismisses the card', () => {
    const dismissWelcomeBack = vi.fn();
    useVelocityStore.setState({ dismissWelcomeBack });

    const datasets = [makeDataset()];
    const { result } = renderHook(() => useWelcomeBack({ datasets, onOpenDataset }));

    act(() => {
      result.current.onResume();
    });

    expect(onOpenDataset).toHaveBeenCalledWith(datasets[0]);
    expect(dismissWelcomeBack).toHaveBeenCalledOnce();
  });

  it('onDismiss calls dismissWelcomeBack', () => {
    const dismissWelcomeBack = vi.fn();
    useVelocityStore.setState({ dismissWelcomeBack });

    const datasets = [makeDataset()];
    const { result } = renderHook(() => useWelcomeBack({ datasets, onOpenDataset }));

    act(() => {
      result.current.onDismiss();
    });

    expect(dismissWelcomeBack).toHaveBeenCalledOnce();
    expect(onOpenDataset).not.toHaveBeenCalled();
  });
});
