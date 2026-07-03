import { useCallback } from 'react';
import { velocity } from '../../../theme/themes';
import { useVelocityStore } from '../../../store';
import { buildExportConfig } from '../../../core/export/buildExportConfig';
import { resolveExportBranding } from '../../../core/export/resolveThemeColors';
import { useResolvedVariables } from './useResolvedVariables';

const exportBranding = resolveExportBranding(velocity);

/**
 * Shared export entry point for toolbar and command palette.
 */
export function useAnalysisExportAction() {
  const openAnalysisExportModal = useVelocityStore((state) => state.openAnalysisExportModal);
  const queryResult = useVelocityStore((state) => state.queryResult);
  const dataset = useVelocityStore((state) => state.dataset);
  const slides = useVelocityStore((state) => state.slides);
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const { resolvedRowVars, resolvedColVar, firstRowVarSet } = useResolvedVariables();

  const isMultipleResponse = firstRowVarSet?.structure === 'multiple';
  const isWeighted = !!dataset?.weightVariable;
  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? null;

  const buildCurrentExportConfig = useCallback(() => {
    const title = activeSlide?.title || dataset?.name || 'Analysis Report';
    return buildExportConfig({
      title,
      data: queryResult,
      rowVariables: resolvedRowVars,
      colVariable: resolvedColVar,
      isWeighted,
      isMultipleResponse,
      viewType: activeSlide?.visualizationType,
      chartType: activeSlide?.chartType,
      branding: exportBranding,
    });
  }, [
    activeSlide?.title,
    activeSlide?.visualizationType,
    activeSlide?.chartType,
    dataset?.name,
    queryResult,
    resolvedRowVars,
    resolvedColVar,
    isWeighted,
    isMultipleResponse,
  ]);

  const openExport = useCallback(() => {
    if (!dataset) return false;
    openAnalysisExportModal(buildCurrentExportConfig());
    return true;
  }, [dataset, openAnalysisExportModal, buildCurrentExportConfig]);

  return { openExport, canExport: !!dataset };
}
