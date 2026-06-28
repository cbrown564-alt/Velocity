import { describe, expect, it } from 'vitest';
import {
  buildQualitySummary,
  evaluateTimingTargets,
  summarizeRecoverabilityChecks,
} from '../../demo/scripts/demo-quality.mjs';

describe('demo runner quality summary', () => {
  it('evaluates timing targets from completed step durations', () => {
    const results = evaluateTimingTargets(
      [
        { id: 'first-crosstab', durationMs: 4200, status: 'passed' },
        { id: 'open-export-modal', durationMs: 1200, status: 'passed' },
      ],
      [
        { stepId: 'first-crosstab', maxDurationMs: 5000, label: 'first representative crosstab' },
        { stepId: 'open-export-modal', maxDurationMs: 1000, label: 'export review opens' },
      ]
    );

    expect(results).toEqual([
      expect.objectContaining({ stepId: 'first-crosstab', status: 'passed' }),
      expect.objectContaining({ stepId: 'open-export-modal', status: 'failed' }),
    ]);
  });

  it('keeps recoverability checks explicit when a contract cannot automate them yet', () => {
    const checks = summarizeRecoverabilityChecks([
      { id: 'title-edit-undo', status: 'manual', description: 'Undo title edit with Cmd+Z.' },
      { id: 'reopen-draft', status: 'automated', description: 'Draft restored after reload.' },
    ]);

    expect(checks).toEqual([
      expect.objectContaining({ id: 'title-edit-undo', status: 'manual' }),
      expect.objectContaining({ id: 'reopen-draft', status: 'automated' }),
    ]);
  });

  it('combines timings, console errors, and recoverability into one quality block', () => {
    const quality = buildQualitySummary({
      steps: [{ id: 'export-pptx', durationMs: 2800, status: 'passed' }],
      timingTargets: [{ stepId: 'export-pptx', maxDurationMs: 3000, label: 'one-slide PPTX export' }],
      recoverabilityChecks: [{ id: 'title-edit-undo', status: 'manual', description: 'Undo title edit with Cmd+Z.' }],
      consoleMessages: [{ type: 'error', text: 'boom' }],
      pageErrors: [],
    });

    expect(quality.status).toBe('needs_review');
    expect(quality.timingTargets[0].status).toBe('passed');
    expect(quality.consoleErrors).toEqual(['boom']);
    expect(quality.recoverabilityChecks[0].status).toBe('manual');
  });
});
