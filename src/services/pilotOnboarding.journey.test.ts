import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  markBootStart,
  recordEngineReady,
  recordEngineWarmupIntent,
  clearPilotEventLog,
  getPilotEventLog,
  resetPilotSession,
} from './pilotOnboarding';

describe('pilotOnboarding journey telemetry', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPilotEventLog();
    resetPilotSession();
  });

  it('records boot_start and engine_ready with durationFromBootMs', () => {
    vi.useFakeTimers();
    markBootStart();
    vi.advanceTimersByTime(250);
    recordEngineReady({ duckdbBundle: 'eh', wasmCacheState: 'miss' });

    const events = getPilotEventLog();
    expect(events.map((e) => e.name)).toEqual(['boot_start', 'engine_ready']);
    expect(events[1].payload?.durationFromBootMs).toBe(250);
    expect(events[1].payload?.duckdbBundle).toBe('eh');
    vi.useRealTimers();
  });

  it('records engine_warmup_intent with source', () => {
    recordEngineWarmupIntent('landing-upload');
    expect(getPilotEventLog()[0]).toMatchObject({
      name: 'engine_warmup_intent',
      payload: { source: 'landing-upload' },
    });
  });
});
