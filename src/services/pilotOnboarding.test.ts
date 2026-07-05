import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordPilotEvent,
  getPilotEventLog,
  buildPilotEventExport,
  clearPilotEventLog,
  resetPilotSession,
  downloadPilotEventLog,
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

  it('records landing_view only once per session', () => {
    recordPilotEvent('landing_view');
    const duplicate = recordPilotEvent('landing_view');
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

  it('downloadPilotEventLog triggers a JSON file download', () => {
    recordPilotEvent('pptx_exported', { slideCount: 1 });
    const click = vi.fn();
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const link = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValue(link);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => link);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => link);
    link.click = click;

    downloadPilotEventLog();

    expect(click).toHaveBeenCalled();
    expect(link.download).toMatch(/^velocity-pilot-events-\d{4}-\d{2}-\d{2}\.json$/);
    expect(revoke).toHaveBeenCalledWith('blob:mock');
  });
});
