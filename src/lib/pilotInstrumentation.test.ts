import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isPilotInstrumentationVisible } from './pilotInstrumentation';

describe('isPilotInstrumentationVisible', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true in dev mode', () => {
    vi.stubEnv('DEV', true);
    expect(isPilotInstrumentationVisible()).toBe(true);
  });

  it('returns true when VITE_PILOT_INSTRUMENTATION is set', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PILOT_INSTRUMENTATION', 'true');
    expect(isPilotInstrumentationVisible()).toBe(true);
  });

  it('returns true when localStorage opt-in is set', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PILOT_INSTRUMENTATION', '');
    localStorage.setItem('velocity-pilot-instrumentation', '1');
    expect(isPilotInstrumentationVisible()).toBe(true);
  });
});
