import { describe, expect, it } from 'vitest';
import { toCloneSafePayload } from './engineMessaging';

describe('toCloneSafePayload', () => {
  it('converts BigInt values to strings for structured clone', () => {
    const payload = {
      type: 'engine.queryResult' as const,
      requestId: 'req-1',
      data: [{ count: 1n }],
      durationMs: 5,
    };

    const safe = toCloneSafePayload(payload);
    expect(safe.data[0].count).toBe('1');
    expect(() => structuredClone(safe)).not.toThrow();
  });
});
