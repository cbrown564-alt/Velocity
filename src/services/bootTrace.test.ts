import { beforeEach, describe, expect, it } from 'vitest';
import { beginBootTrace, getBootTraceSnapshot, recordBootTrace, resetBootTraceForTests } from './bootTrace';

describe('bootTrace', () => {
  beforeEach(() => {
    resetBootTraceForTests();
  });

  it('keeps one correlation id across main-thread and worker events', () => {
    const correlationId = beginBootTrace('file-upload');
    recordBootTrace({ phase: 'analysis_worker.created', status: 'completed', source: 'main' });
    recordBootTrace({
      correlationId,
      phase: 'engine.init.received',
      status: 'completed',
      source: 'analysis-worker',
    });

    const snapshot = getBootTraceSnapshot();
    expect(snapshot.correlationId).toBe(correlationId);
    expect(snapshot.events).toHaveLength(3);
    expect(new Set(snapshot.events.map((event) => event.correlationId))).toEqual(new Set([correlationId]));
  });

  it('bounds trace size and removes survey-shaped detail', () => {
    beginBootTrace('file-upload');
    for (let index = 0; index < 300; index += 1) {
      recordBootTrace({
        phase: 'duckdb.instantiate',
        status: 'progress',
        source: 'analysis-worker',
        detail: {
          index,
          dataset: 'must-not-survive',
          buffer: 'must-not-survive',
          note: 'x'.repeat(1_000),
        },
      });
    }

    const snapshot = getBootTraceSnapshot();
    expect(snapshot.events.length).toBeLessThanOrEqual(200);
    expect(snapshot.events.at(-1)?.sequence).toBe(301);
    expect(JSON.stringify(snapshot)).not.toContain('must-not-survive');
    expect(JSON.stringify(snapshot).length).toBeLessThan(100_000);
  });

  it('records the terminal phase for failure artifact collection', () => {
    beginBootTrace('file-upload');
    recordBootTrace({
      phase: 'duckdb.instantiate',
      status: 'timeout',
      source: 'analysis-worker',
      detail: { timeoutMs: 60_000 },
    });

    expect(getBootTraceSnapshot()).toMatchObject({
      terminal: {
        phase: 'duckdb.instantiate',
        status: 'timeout',
      },
    });
  });
});
