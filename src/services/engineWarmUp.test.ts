import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  warmUpEngineOnIntent,
  shouldWarmEngineOnBoot,
  getEngineWarmUpSource,
  resetEngineWarmUpForTests,
} from './engineWarmUp';
import { STORAGE_KEY } from '../store/persistConfig';

const initWorker = vi.fn().mockResolvedValue(undefined);

vi.mock('../store', () => ({
  useVelocityStore: {
    getState: vi.fn(() => ({ initWorker })),
  },
}));

vi.mock('./duckdbWasmCache', () => ({
  registerDuckDbWasmCache: vi.fn().mockResolvedValue(null),
  prefetchDuckDbWasmAssets: vi.fn().mockResolvedValue(undefined),
  probeDuckDbWasmCache: vi.fn().mockResolvedValue('miss'),
}));

describe('engineWarmUp', () => {
  beforeEach(() => {
    localStorage.clear();
    resetEngineWarmUpForTests();
    vi.clearAllMocks();
  });

  it('shouldWarmEngineOnBoot is false for fresh sessions', () => {
    expect(shouldWarmEngineOnBoot()).toBe(false);
  });

  it('shouldWarmEngineOnBoot is true when workspace datasets exist in persisted state', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          workspace: { datasets: [{ id: 'ds-1' }] },
        },
      }),
    );
    expect(shouldWarmEngineOnBoot()).toBe(true);
  });

  it('warmUpEngineOnIntent is idempotent and records source', async () => {
    await warmUpEngineOnIntent('landing-upload');
    expect(getEngineWarmUpSource()).toBe('landing-upload');
    expect(initWorker).toHaveBeenCalledTimes(1);

    await warmUpEngineOnIntent('other');
    expect(initWorker).toHaveBeenCalledTimes(1);
  });
});
