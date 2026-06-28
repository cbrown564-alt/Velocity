import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as opfsFileManager from '../../../services/opfsFileManager';
import { assignOpfsKeyAndLoad, assignOpfsStorageForUpload } from './assignOpfsKeyAndLoad';

vi.mock('../../../services/opfsFileManager', () => ({
  getStorageEstimate: vi.fn(),
  generateStorageKey: vi.fn((name: string) => `stored_${name}`),
  storeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('assignOpfsStorageForUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(opfsFileManager.getStorageEstimate).mockResolvedValue({
      usage: 0,
      quota: 1_000_000_000,
    });
  });

  it('stores the file in OPFS and returns the storage key', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'sleep.sav', { type: 'application/octet-stream' });

    const result = await assignOpfsStorageForUpload(file, true);

    expect(opfsFileManager.generateStorageKey).toHaveBeenCalledWith('sleep.sav');
    expect(opfsFileManager.storeFile).toHaveBeenCalledWith('stored_sleep.sav', expect.any(ArrayBuffer));
    expect(result.storageKey).toBe('stored_sleep.sav');
    expect(result.buffer.byteLength).toBe(3);
  });

  it('skips OPFS when unavailable and still returns a buffer', async () => {
    const file = new File([new Uint8Array([4])], 'small.sav', { type: 'application/octet-stream' });

    const result = await assignOpfsStorageForUpload(file, false);

    expect(opfsFileManager.storeFile).not.toHaveBeenCalled();
    expect(result.storageKey).toBeNull();
    expect(result.buffer.byteLength).toBe(1);
  });

  it('falls back when quota is insufficient', async () => {
    vi.mocked(opfsFileManager.getStorageEstimate).mockResolvedValue({
      usage: 999,
      quota: 1000,
    });
    const file = new File([new Uint8Array(200)], 'large.sav', { type: 'application/octet-stream' });

    const result = await assignOpfsStorageForUpload(file, true);

    expect(opfsFileManager.storeFile).not.toHaveBeenCalled();
    expect(result.storageKey).toBeNull();
    expect(result.buffer.byteLength).toBe(200);
  });
});

describe('assignOpfsKeyAndLoad', () => {
  it('passes dataset id and OPFS key to loadSAV', async () => {
    const loadSAV = vi.fn().mockResolvedValue(undefined);
    const buffer = new ArrayBuffer(8);

    await assignOpfsKeyAndLoad('sleep.sav', buffer, loadSAV, {
      datasetId: 'ds-1',
      opfsFileKey: 'sleep_123.sav',
    });

    expect(loadSAV).toHaveBeenCalledWith('sleep.sav', buffer, {
      datasetId: 'ds-1',
      opfsFileKey: 'sleep_123.sav',
    });
  });

  it('omits opfsFileKey when storage was skipped', async () => {
    const loadSAV = vi.fn().mockResolvedValue(undefined);
    const buffer = new ArrayBuffer(4);

    await assignOpfsKeyAndLoad('sleep.sav', buffer, loadSAV, { opfsFileKey: null });

    expect(loadSAV).toHaveBeenCalledWith('sleep.sav', buffer, {
      datasetId: undefined,
      opfsFileKey: undefined,
    });
  });
});
