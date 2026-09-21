import { useEffect, useRef } from 'react';
import { useVelocityStore } from '../../../store';
import { AUTO_CROSSTAB_EXAMPLES } from '../lib/autoFirstCrosstab';
import { evaluateCanvasHandoff } from '../lib/canvasHandoff';

/**
 * One-time canvas handoff after Workshop Door upload (DESIGN-CONV-H).
 * Ensures slide 1 is active; optionally auto-opens insert palette on first entry.
 */
export function useCanvasHandoff(): void {
  const canvasHandoffTrigger = useVelocityStore((state) => state.canvasHandoffTrigger);
  const hasSeenCanvasHandoff = useVelocityStore((state) => state.hasSeenCanvasHandoff);
  const dataset = useVelocityStore((state) => state.dataset);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const slides = useVelocityStore((state) => state.slides);
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const setActiveSlide = useVelocityStore((state) => state.setActiveSlide);
  const openCommandPalette = useVelocityStore((state) => state.openCommandPalette);
  const clearCanvasHandoff = useVelocityStore((state) => state.clearCanvasHandoff);
  const markCanvasHandoffSeen = useVelocityStore((state) => state.markCanvasHandoffSeen);

  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current || !canvasHandoffTrigger || !dataset) return;

    // Child mount effects may already have created the example crosstab.
    // Decide from live state so the handoff does not cover that result.
    const current = useVelocityStore.getState();
    const currentTableConfig = current.tableConfig;
    if (AUTO_CROSSTAB_EXAMPLES.has(dataset.name) && !current.hasSeenAutoCrosstab) {
      consumedRef.current = true;
      clearCanvasHandoff();
      return;
    }
    const decision = evaluateCanvasHandoff({
      trigger: canvasHandoffTrigger,
      hasSeenCanvasHandoff,
      rowCount: dataset.rowCount,
      variableCount: dataset.variables.length,
      metadataOnly: dataset.metadataOnly ?? false,
      hasExistingAnalysis: currentTableConfig.rowVars.length > 0 || currentTableConfig.colVar != null,
    });

    consumedRef.current = true;
    clearCanvasHandoff();

    if (!decision.activate) return;

    markCanvasHandoffSeen();

    const firstSlideId = slides[0]?.id;
    if (firstSlideId && activeSlideId !== firstSlideId) {
      setActiveSlide(firstSlideId);
    }

    if (decision.openPalette) {
      openCommandPalette();
    }
  }, [
    canvasHandoffTrigger,
    hasSeenCanvasHandoff,
    dataset,
    tableConfig.rowVars.length,
    tableConfig.colVar,
    slides,
    activeSlideId,
    setActiveSlide,
    openCommandPalette,
    clearCanvasHandoff,
    markCanvasHandoffSeen,
  ]);
}
