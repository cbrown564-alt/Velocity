import { describe, expect, it } from 'vitest';
import { CANVAS_HANDOFF_MAX_CELLS, evaluateCanvasHandoff, type CanvasHandoffContext } from './canvasHandoff';

function ctx(overrides: Partial<CanvasHandoffContext> = {}): CanvasHandoffContext {
  return {
    trigger: 'fresh_upload',
    hasSeenCanvasHandoff: false,
    rowCount: 500,
    variableCount: 20,
    metadataOnly: false,
    hasExistingAnalysis: false,
    ...overrides,
  };
}

describe('evaluateCanvasHandoff (DESIGN-CONV-H)', () => {
  it('activates with palette auto-open on first fresh upload within size gate', () => {
    expect(evaluateCanvasHandoff(ctx())).toEqual({ activate: true, openPalette: true });
  });

  it('activates without palette on datasets above the cell gate', () => {
    const rowCount = 10_000;
    const variableCount = Math.ceil(CANVAS_HANDOFF_MAX_CELLS / rowCount) + 1;
    expect(evaluateCanvasHandoff(ctx({ rowCount, variableCount }))).toEqual({
      activate: true,
      openPalette: false,
    });
  });

  it('does not activate when the handoff was already consumed', () => {
    expect(evaluateCanvasHandoff(ctx({ hasSeenCanvasHandoff: true }))).toEqual({
      activate: false,
      openPalette: false,
    });
  });

  it('does not activate without a pending trigger', () => {
    expect(evaluateCanvasHandoff(ctx({ trigger: null }))).toEqual({
      activate: false,
      openPalette: false,
    });
  });

  it('does not activate for metadata-only loads', () => {
    expect(evaluateCanvasHandoff(ctx({ metadataOnly: true }))).toEqual({
      activate: false,
      openPalette: false,
    });
  });

  it('does not activate when analysis is already configured', () => {
    expect(evaluateCanvasHandoff(ctx({ hasExistingAnalysis: true }))).toEqual({
      activate: false,
      openPalette: false,
    });
  });
});
