/**
 * DESIGN-CONV-H — Workshop Door → canvas handoff (slide 1 + optional palette).
 * Pure evaluation; no React or store dependencies.
 */

export type CanvasHandoffTrigger = 'fresh_upload';

/** Skip auto-open palette above this estimated cell count (row × variable). */
export const CANVAS_HANDOFF_MAX_CELLS = 1_000_000;

export interface CanvasHandoffContext {
  trigger: CanvasHandoffTrigger | null;
  hasSeenCanvasHandoff: boolean;
  rowCount: number;
  variableCount: number;
  metadataOnly: boolean;
  hasExistingAnalysis: boolean;
}

export interface CanvasHandoffDecision {
  /** Land on slide 1 and consume the one-time handoff. */
  activate: boolean;
  /** Auto-open insert palette (subset of activate; size-gated). */
  openPalette: boolean;
}

export function evaluateCanvasHandoff(ctx: CanvasHandoffContext): CanvasHandoffDecision {
  const inactive = { activate: false, openPalette: false } as const;

  if (ctx.trigger !== 'fresh_upload') return inactive;
  if (ctx.hasSeenCanvasHandoff) return inactive;
  if (ctx.metadataOnly) return inactive;
  if (ctx.hasExistingAnalysis) return inactive;

  const estimatedCells = ctx.rowCount * ctx.variableCount;
  const withinSizeGate = estimatedCells <= CANVAS_HANDOFF_MAX_CELLS;

  return {
    activate: true,
    openPalette: withinSizeGate,
  };
}
