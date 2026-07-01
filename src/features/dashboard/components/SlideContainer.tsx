import React, { useMemo } from 'react';
import { AlertCircle, LayoutGrid, RefreshCw, Sparkles, MousePointerClick } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVelocityStore } from '../../../store';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { DataTable } from './DataTable';
import { SlideHeader } from './SlideHeader';
import { AnalysisChartConfig } from '../../../types/charts';
import { Variable } from '../../../types';

import { computeAnalysisSampleSize } from '../../../core/analysis/computeAnalysisSampleSize';
import { recommendChart } from '../../../core/visualization/chartRecommender';
import { useResolvedVariables } from '../hooks/useResolvedVariables';
import { useSuggestedVariables } from '../hooks/useSuggestedVariables';
import { useAutoFirstCrosstab } from '../hooks/useAutoFirstCrosstab';
import { applyCanvasPlacement } from '../../../core/grid/gridUtils';
import { getMotionProps, useReducedMotion, DURATIONS } from '../../../lib/motion';
import { AnalysisOutputFrame } from './AnalysisOutputFrame';
import { AnalysisErrorBoundary } from '../../../components/common/AnalysisErrorBoundary';
import { VIRTUALIZE_ROW_THRESHOLD } from './crosstabVirtualization';
import './SlideHeader.css';

interface SlideContainerProps {
  className?: string;
}

const EMPTY_VARIABLES: Variable[] = [];

/**
 * Renders the active slide's layout and content.
 * For Phase 2.5, this primarily supports 'focus' mode (single cell).
 */
export const SlideContainer: React.FC<SlideContainerProps> = ({ className = '' }) => {
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const slides = useVelocityStore((state) => state.slides);
  const activeSlide = slides.find((s) => s.id === activeSlideId);

  // Data access
  const chartData = useVelocityStore((state) => state.queryResult);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const allVariables = useVelocityStore((state) => state.dataset?.variables ?? EMPTY_VARIABLES);
  const isWeighted = useVelocityStore((state) => !!state.dataset?.weightVariable);
  const variableStats = useVelocityStore((state) => state.activeVariableStats);
  const tableStats = useVelocityStore((state) => state.tableStats);
  const queryError = useVelocityStore((state) => state.queryError);
  const isQuerying = useVelocityStore((state) => state.isQuerying);
  const openDrillDown = useVelocityStore((state) => state.openDrillDown);
  const tableDensity = useVelocityStore((state) => state.tableDensity);
  const focusMode = useVelocityStore((state) => state.focusMode);
  const dataset = useVelocityStore((state) => state.dataset);

  const totalCount = useMemo(() => {
    const fromQuery = computeAnalysisSampleSize(chartData, { isWeighted });
    if (fromQuery !== null) return fromQuery;
    return useVelocityStore.getState().dataset?.rowCount || 0;
  }, [chartData, isWeighted]);

  const { resolvedRowVars, resolvedColVar, firstRowVarSet: firstVarSet } = useResolvedVariables();

  const isMultipleResponse = firstVarSet?.structure === 'multiple';

  const chartRecommendation = useMemo(() => {
    if (resolvedRowVars.length === 0) return null;

    return recommendChart({
      rowVars: resolvedRowVars,
      colVar: resolvedColVar,
      isGrid: firstVarSet?.structure === 'grid',
      isMultiResponse: isMultipleResponse,
    });
  }, [resolvedRowVars, resolvedColVar, firstVarSet, isMultipleResponse]);

  const inUseIds = useMemo(
    () => new Set([...tableConfig.rowVars, ...(tableConfig.colVar ? [tableConfig.colVar] : [])]),
    [tableConfig.rowVars, tableConfig.colVar],
  );

  const suggestions = useSuggestedVariables(allVariables, variableSets, inUseIds, 3, dataset?.rowCount);
  const reducedMotion = useReducedMotion();
  useAutoFirstCrosstab(resolvedRowVars.length, tableConfig.colVar);

  if (!activeSlide) {
    return <div className="p-4 text-[var(--text-secondary)]">No active slide</div>;
  }

  const cell = activeSlide.cells[0];
  if (!cell) {
    return <div className="p-4 text-[var(--text-secondary)]">Empty slide</div>;
  }

  const handleSuggestClick = (setId: string) => {
    const set = variableSets.find((s) => s.id === setId);
    if (!set) return;

    useVelocityStore
      .getState()
      .setTableConfig(applyCanvasPlacement(setId, set.structure, useVelocityStore.getState().tableConfig));
  };

  const analysisResetKey = `${activeSlideId}:${tableConfig.rowVars.join(',')}:${tableConfig.colVar ?? ''}:${activeSlide.visualizationType}`;
  const analysisSurface = activeSlide.visualizationType === 'chart' ? 'chart' : 'table';
  const tableNeedsFill =
    resolvedRowVars.length > 0 &&
    activeSlide.visualizationType === 'table' &&
    chartData.length > VIRTUALIZE_ROW_THRESHOLD;
  const shrinkWrapSlide = resolvedRowVars.length > 0 && !tableNeedsFill;

  const renderCellContent = () => {
    if (queryError && !isQuerying) {
      return (
        <motion.div
          {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.enter, reducedMotion })}
          className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-4 p-8 bg-[var(--status-error-surface)] border border-[var(--status-error-border)] text-center"
          role="alert"
        >
          <AlertCircle size={32} className="text-[var(--color-error)]" />
          <motion.div
            {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.fast, reducedMotion })}
            className="space-y-1 max-w-md"
          >
            <p className="text-base font-medium text-[var(--text-primary)]">Couldn&apos;t run analysis</p>
            <p className="text-sm text-[var(--text-secondary)]">{queryError}</p>
          </motion.div>
          <button
            type="button"
            onClick={() => void useVelocityStore.getState().runAnalysis()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </motion.div>
      );
    }

    if (resolvedRowVars.length === 0) {
      return (
        <motion.div
          {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.enter, reducedMotion })}
          className="w-full h-full rounded-xl flex flex-col items-center justify-center text-[var(--text-secondary)] gap-5 bg-gradient-to-b from-[var(--bg-panel)] to-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-inset-lg relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-20" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--bg-active)] border border-[var(--border-color)] shadow-sm">
            <LayoutGrid size={32} className="text-[var(--color-accent)] opacity-80" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-base font-medium text-[var(--text-primary)]">Ready for Analysis</p>
            <p className="text-sm">Drag or click variables to start building your view.</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Tip: press{' '}
              <kbd className="px-1 rounded bg-[var(--bg-active)] border border-[var(--border-color-muted)]">⌘K</kbd> to
              search variables and run commands.
            </p>
          </div>

          {suggestions.length > 0 && (
            <div className="flex flex-col items-center gap-3 mt-2 max-w-lg px-4">
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                <Sparkles size={12} className="text-[var(--color-accent)]" />
                <span>Suggested starting points</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={s.setId}
                    {...getMotionProps({
                      preset: 'fadeScale',
                      duration: DURATIONS.fast,
                      delay: i * 0.05,
                      reducedMotion,
                    })}
                    onClick={() => handleSuggestClick(s.setId)}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-active)] border border-[var(--border-color)] hover:border-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent),transparent_92%)] transition-all text-left max-w-[280px]"
                    title={`${s.name} — ${s.reason}`}
                  >
                    <MousePointerClick
                      size={14}
                      className="text-[var(--text-secondary)] group-hover:text-[var(--color-accent)] transition-colors shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-sm font-medium text-[var(--text-primary)] truncate leading-snug"
                        title={s.name}
                      >
                        {s.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] truncate leading-snug" title={s.reason}>
                        {s.reason}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      );
    }

    const viewType = activeSlide.visualizationType;

    switch (viewType) {
      case 'chart': {
        const recommendedType = chartRecommendation?.default || 'horizontal-bar';
        const config: AnalysisChartConfig = {
          type: cell.content.chartType || recommendedType,
          enableVisualETL: true,
        };
        return (
          <AnalysisOutputFrame
            bodyPadding="chart"
            density={tableDensity}
            reducedMotion={reducedMotion}
            bleed={focusMode}
            frameClassName="shrink-wrap"
          >
            <AnalysisChart
              data={chartData}
              config={config}
              rowVariables={resolvedRowVars}
              colVariable={resolvedColVar}
              isWeighted={isWeighted}
              isMultipleResponse={isMultipleResponse}
              variableStats={variableStats}
              contentSized
            />
          </AnalysisOutputFrame>
        );
      }
      case 'table':
        return (
          <DataTable
            data={chartData}
            rowVariables={resolvedRowVars}
            colVariable={resolvedColVar}
            totalCount={totalCount}
            isWeighted={isWeighted}
            variableStats={variableStats}
            tableStats={tableStats}
            isMultipleResponse={isMultipleResponse}
            density={tableDensity}
            frameBleed={focusMode}
            onCellClick={(rowPath, colValue) => void openDrillDown(rowPath, colValue)}
          />
        );
      default:
        return <div>Unknown content type</div>;
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 h-full bg-glass-app ${focusMode && shrinkWrapSlide ? 'justify-center' : ''} ${className}`}
      aria-busy={isQuerying}
      aria-live="polite"
    >
      {isQuerying && (
        <div className="sr-only" role="status">
          Updating analysis results
        </div>
      )}
      <div
        className={`surface-panel w-full max-w-[min(100%,1400px)] mx-auto flex flex-col min-h-0 max-h-full rounded-xl shadow-md border border-[var(--border-color)] ${
          shrinkWrapSlide ? 'flex-none self-start' : 'flex-1 self-stretch'
        }`}
      >
        <div className={`flex-shrink-0 ${focusMode ? 'px-4 pt-4' : 'px-6 pt-5'}`}>
          <SlideHeader className={focusMode ? 'compact' : ''} />
        </div>

        <div
          className={`${shrinkWrapSlide ? 'flex-none' : 'flex-1'} min-h-0 flex flex-col overflow-x-auto overflow-y-auto ${focusMode ? 'px-0 pb-2' : 'px-6 pb-6'}`}
          data-testid="slide-content-region"
        >
          <AnalysisErrorBoundary
            surface={analysisSurface}
            slideId={activeSlideId}
            resetKey={analysisResetKey}
            onRetry={() => void useVelocityStore.getState().runAnalysis()}
          >
            <div key={analysisResetKey} className="min-h-0 animate-[fadeIn_0.15s_ease-out]">
              {renderCellContent()}
            </div>
          </AnalysisErrorBoundary>
        </div>
      </div>
    </div>
  );
};
