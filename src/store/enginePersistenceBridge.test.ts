import { describe, expect, it, vi } from 'vitest';
import {
  createEnginePersistenceCallbacks,
  type EnginePersistenceBridge,
} from './enginePersistenceBridge';

describe('enginePersistenceBridge callbacks', () => {
  it('maps persistence status updates onto bridge state', () => {
    const applyPersistenceStatus = vi.fn();
    const applyCorruption = vi.fn();
    const bridge: EnginePersistenceBridge = { applyPersistenceStatus, applyCorruption };

    const { onPersistenceStatus } = createEnginePersistenceCallbacks(bridge);

    onPersistenceStatus?.({
      type: 'engine.persistenceStatus',
      requestId: 'req-1',
      opfsAvailable: true,
      mode: 'opfs',
      lastError: null,
      dbPath: 'opfs://datasets/ds-1.db',
    });

    expect(applyPersistenceStatus).toHaveBeenCalledWith({
      opfsAvailable: true,
      persistenceMode: 'opfs',
      persistenceError: null,
      activeDbPath: 'opfs://datasets/ds-1.db',
    });
    expect(applyCorruption).not.toHaveBeenCalled();
  });

  it('maps corruption events onto bridge state', () => {
    const applyPersistenceStatus = vi.fn();
    const applyCorruption = vi.fn();
    const bridge: EnginePersistenceBridge = { applyPersistenceStatus, applyCorruption };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { onCorruption } = createEnginePersistenceCallbacks(bridge, { corruptionLogLabel: ' during respawn' });

    onCorruption?.({
      type: 'engine.corruptionDetected',
      requestId: 'req-2',
      message: 'checksum mismatch',
    });

    expect(applyCorruption).toHaveBeenCalledWith({
      persistenceState: 'corrupt',
      persistenceError: 'checksum mismatch',
      opfsAvailable: false,
      persistedDataInfo: null,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[enginePersistenceBridge] OPFS corruption detected during respawn:',
      'checksum mismatch',
    );

    warnSpy.mockRestore();
  });
});
