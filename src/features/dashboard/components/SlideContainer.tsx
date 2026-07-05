import React, { useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { DataTable } from './DataTable';
import { SlideHeader } from './SlideHeader';
import { AnalysisChartConfig } from '../../../types/charts';

import { computeAnalysisSampleSize } from '../../../core/analysis/computeAnalysisSampleSize';
import { recommendChart } from '../../../core/visualization/chartRecommender';
import { useResolvedVariables } from '../hooks/useResolvedVariables';
import { useAutoFirstCrosstab } from '../hooks/useAutoFirstCrosstab';
import { AnalysisOutputFrame } from './AnalysisOutputFrame';
import { AnalysisErrorBoundary } from '../../../components/common/AnalysisErrorBoundary';
import { StatisticsStatusBar } from '../../../components/common/StatisticsStatusBar';
import { VIRTUALIZE_ROW_THRESHOLD } from './crosstabVirtualization';
import './SlideHeader.css';

interface SlideContainerProps {
  className?: string;
}

export const SlideContainer: React.FC<SlideContainerProps> = ({ className = '' }) => {
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const slides = useVelocityStore((state) => state.slides);
  const activeSlide = slides.find((s) => s.id === activeSlideId);

  const chartData = useVelocityStore((state) => state.queryResult);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const isWeighted = useVelocityStore((state) => !!state.dataset?.weightVariable);
  const variableStats = useVelocityStore((state) => state.activeVariableStats);
  const tableStats = useVelocityStore((state) => state.tableStats);
  const queryError = useVelocityStore((state) => state.queryError);
  const isQuerying = useVelocityStore((state) => state.isQuerying);
  const openDrillDown = useVelocityStore((state) => state.openDrillDown);
  const tableDensity = useVelocityStore((state) => state.tableDensity);
  const focusMode = useVelocityStore((state) => state.focusMode);
  const analysisSettings = useVelocityStore((state) => state.analysisSettings);

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

  useAutoFirstCrosstab(resolvedRowVars.length, tableConfig.colVar);
  const overlapCorrected = useMemo(() => chartData.some((row) => row.stats?.isOverlapCorrected), [chartData]);

  if (!activeSlide) {
    return <div className="p-4 text-[13px] text-[var(--text-secondary)]">Select a slide</div>;
  }

  const cell = activeSlide.cells[0];
  if (!cell) {
    return <div className="p-4 text-[13px] text-[var(--text-secondary)]">Add content to this slide</div>;
  }

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
        <div
          className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-4 p-8 bg-[var(--status-error-surface)] border border-[var(--status-error-border)] text-center"
          role="alert"
        >
          <AlertCircle size={32} className="text-[var(--color-error)]" />
          <div className="space-y-1 max-w-md">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">Analysis failed</p>
            <p className="text-[13px] text-[var(--text-secondary)]">{queryError}</p>
          </div>
          <button
            type="button"
            onClick={() => void useVelocityStore.getState().runAnalysis()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--text-primary)] text-[var(--text-inverse)] text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      );
    }

    if (resolvedRowVars.length === 0) {
      return (
        <div
          className="w-full min-h-[340px] h-full flex flex-col items-center justify-center gap-4"
          data-testid="empty-slide-state"
        >
          <p className="text-[13px] text-[var(--text-secondary)]">
            Drag a variable here, or press{' '}
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-panel-tint)] font-mono text-[11px]">
              ⌘K
            </kbd>
            .
          </p>
          <button
            type="button"
            onClick={() => useVelocityStore.getState().openCommandPalette()}
            className="px-3 py-1.5 rounded-md border border-[var(--border-color)] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-panel-tint)] transition-colors"
          >
            Browse variables
          </button>
        </div>
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
            isMultipleResponse={isMultipleResponse}
            density={tableDensity}
            frameBleed={focusMode}
            onCellClick={(rowPath, colValue) => void openDrillDown(rowPath, colValue)}
          />
        );
      default:
        return <div className="text-[13px] text-[var(--text-secondary)]">Unsupported visualization type</div>;
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
            <div key={analysisResetKey} className="min-h-0">
              {renderCellContent()}
            </div>
          </AnalysisErrorBoundary>
        </div>
      </div>

      {activeSlide.visualizationType === 'table' && resolvedRowVars.length > 0 && !queryError && (
        <div className="w-full max-w-[min(100%,1400px)] mx-auto shrink-0">
          <StatisticsStatusBar
            analysisSettings={analysisSettings}
            tableStats={tableStats}
            colVariable={resolvedColVar}
            overlapCorrected={overlapCorrected}
          />
        </div>
      )}
    </div>
  );
};
