import { describe, it, expect, beforeEach } from 'vitest';
import { isFirstRunLanding } from './firstRunLanding';
import { clearPilotEventLog, recordPilotEvent, resetPilotSession } from '../../../services/pilotOnboarding';

describe('isFirstRunLanding', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPilotEventLog();
    resetPilotSession();
  });

  it('returns true for empty workspace with no activation events', () => {
    expect(isFirstRunLanding(0)).toBe(true);
  });

  it('returns false when datasets exist', () => {
    expect(isFirstRunLanding(1)).toBe(false);
  });

  it('returns false after file_selected event', () => {
    recordPilotEvent('file_selected', { fileName: 'sleep.sav' });
    expect(isFirstRunLanding(0)).toBe(false);
  });

  it('returns false after canvas_ready event', () => {
    recordPilotEvent('canvas_ready', { fileName: 'mock_data.csv', rowCount: 100 });
    expect(isFirstRunLanding(0)).toBe(false);
  });
});
