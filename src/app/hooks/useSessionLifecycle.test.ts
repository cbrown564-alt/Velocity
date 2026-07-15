import { describe, expect, it, vi } from 'vitest';
import { processFileDropAfterEngineReady } from './useSessionLifecycle';

describe('processFileDropAfterEngineReady', () => {
  it('does not hand the file to the loader until engine warm-up completes', async () => {
    let releaseWarmUp!: () => void;
    const warmUp = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseWarmUp = resolve;
        }),
    );
    const clearImportedSessionSemantic = vi.fn();
    const handleDroppedFile = vi.fn().mockResolvedValue(undefined);
    const file = new File(['fixture'], 'sleep.sav');

    const pending = processFileDropAfterEngineReady(file, {
      warmUp,
      clearImportedSessionSemantic,
      handleDroppedFile,
    });
    await Promise.resolve();

    expect(clearImportedSessionSemantic).toHaveBeenCalledOnce();
    expect(handleDroppedFile).not.toHaveBeenCalled();

    releaseWarmUp();
    await pending;

    expect(handleDroppedFile).toHaveBeenCalledWith(file);
  });
});
