import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordPilotEvent,
  getPilotEventLog,
  buildPilotEventExport,
  clearPilotEventLog,
  resetPilotSession,
} from './pilotOnboarding';

describe('pilotOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPilotEventLog();
    resetPilotSession();
  });

  it('records events with elapsed time from session start', () => {
    const first = recordPilotEvent('file_selected', { fileName: 'sleep.sav' });
    expect(first).not.toBeNull();
    expect(first?.name).toBe('file_selected');
    expect(first?.payload).toEqual({ fileName: 'sleep.sav' });
    expect(first?.elapsedMs).toBeGreaterThanOrEqual(0);

    const log = getPilotEventLog();
    expect(log).toHaveLength(1);
  });

  it('records first_crosstab only once per session', () => {
    recordPilotEvent('first_crosstab', { rowVars: ['sex'], colVar: 'marital' });
    const duplicate = recordPilotEvent('first_crosstab', { rowVars: ['age'] });
    expect(duplicate).toBeNull();
    expect(getPilotEventLog()).toHaveLength(1);
  });

  it('exports JSON log with session metadata', () => {
    recordPilotEvent('canvas_ready', { fileName: 'sleep.sav', rowCount: 271 });
    const exported = JSON.parse(buildPilotEventExport());
    expect(exported.eventCount).toBe(1);
    expect(exported.events[0].name).toBe('canvas_ready');
    expect(exported.sessionStartedAt).toBeTruthy();
  });
});
