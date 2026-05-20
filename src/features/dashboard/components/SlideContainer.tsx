import React, { useEffect, useMemo, useRef } from 'react';
import { AlertCircle, LayoutGrid, RefreshCw, Sparkles, MousePointerClick } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVelocityStore } from '../../../store';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { DataTable } from './DataTable';
import { SlideHeader } from './SlideHeader';
import { AnalysisChartConfig } from '../../../types/charts';
import { Variable } from '../../../types';

import { computeAnalysisSampleSize } from '../../../core/analysis/computeAnalysisSampleSize';
import { recommendChart } from '../../../services/chartRecommender';
import { useResolvedVariables } from '../hooks/useResolvedVariables';
import { useSuggestedVariables } from '../hooks/useSuggestedVariables';
import { getMotionProps, useReducedMotion, DURATIONS } from '../../../lib/motion';
import { AnalysisOutputFrame } from './AnalysisOutputFrame';

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

    const totalCount = useMemo(() => {
        const fromQuery = computeAnalysisSampleSize(chartData, { isWeighted });
        if (fromQuery !== null) return fromQuery;
        return useVelocityStore.getState().dataset?.rowCount || 0;
    }, [chartData, isWeighted]);

    const dataset = useVelocityStore((state) => state.dataset);
    const hasSeenAutoCrosstab = useVelocityStore((state) => state.hasSeenAutoCrosstab);
    const markAutoCrosstabSeen = useVelocityStore((state) => state.markAutoCrosstabSeen);

    /**
     * Resolve VariableSet IDs to Variable objects.
     */
    const { resolvedRowVars, resolvedColVar, firstRowVarSet: firstVarSet } = useResolvedVariables();

    // Check if first row variable set is a multiple response
    const isMultipleResponse = firstVarSet?.structure === 'multiple';

    // Processed data handling moved to individual components
    // const processedData = useProcessedAnalysisData({ ... });

    // Get chart recommendation based on data configuration
    const chartRecommendation = useMemo(() => {
        if (resolvedRowVars.length === 0) return null;

        return recommendChart({
            rowVars: resolvedRowVars,
            colVar: resolvedColVar,
            isGrid: firstVarSet?.structure === 'grid',
            isMultiResponse: isMultipleResponse,
        });
    }, [resolvedRowVars, resolvedColVar, firstVarSet, isMultipleResponse]);

    if (!activeSlide) {
        return <div className="p-4 text-[var(--text-secondary)]">No active slide</div>;
    }

    // Focus mode logic: Render the first cell full screen
    const cell = activeSlide.cells[0];
    if (!cell) {
        return <div className="p-4 text-[var(--text-secondary)]">Empty slide</div>;
    }

    const inUseIds = useMemo(() => new Set([
        ...tableConfig.rowVars,
        ...(tableConfig.colVar ? [tableConfig.colVar] : [])
    ]), [tableConfig.rowVars, tableConfig.colVar]);

    const suggestions = useSuggestedVariables(
        allVariables,
        variableSets,
        inUseIds,
        5,
        dataset?.rowCount
    );
    const reducedMotion = useReducedMotion();
    const autoCrosstabAppliedRef = useRef(false);

    // Quick Win 9.4: Auto-first-crosstab after Load Example (no toast — Story Shelf + deferred backup reminder)
    useEffect(() => {
        if (autoCrosstabAppliedRef.current || hasSeenAutoCrosstab) return;

        const isMockDataset = dataset?.name === 'mock_data.csv';
        const isEmptyDeck = resolvedRowVars.length === 0 && !tableConfig.colVar;
        if (
            !isMockDataset ||
            !isEmptyDeck ||
            suggestions.length < 2 ||
            variableSets.length === 0
        ) {
            return;
        }

        const first = suggestions[0];
        const second = suggestions[1];
        const firstSet = variableSets.find(s => s.id === first.setId);
        const secondSet = variableSets.find(s => s.id === second.setId);
        if (!firstSet || !secondSet) return;

        autoCrosstabAppliedRef.current = true;
        const store = useVelocityStore.getState();

        if (firstSet.structure === 'grid') {
            const itemsId = `${firstSet.id}_items`;
            const scaleId = `${firstSet.id}_scale`;
            store.setTableConfig({ rowVars: [scaleId], colVar: itemsId });
        } else if (secondSet.structure === 'grid') {
            const itemsId = `${secondSet.id}_items`;
            const scaleId = `${secondSet.id}_scale`;
            store.setTableConfig({ rowVars: [firstSet.id], colVar: itemsId });
        } else {
            store.setTableConfig({ rowVars: [firstSet.id], colVar: secondSet.id });
        }

        markAutoCrosstabSeen();
    }, [
        dataset?.name,
        resolvedRowVars.length,
        tableConfig.colVar,
        hasSeenAutoCrosstab,
        suggestions,
        variableSets,
        markAutoCrosstabSeen,
    ]);

    const handleSuggestClick = (setId: string) => {
        const set = variableSets.find(s => s.id === setId);
        if (!set) return;

        // Grid auto-expansion
        if (set.structure === 'grid') {
            const itemsId = `${set.id}_items`;
            const scaleId = `${set.id}_scale`;
            useVelocityStore.getState().setTableConfig({ rowVars: [scaleId], colVar: itemsId });
            return;
        }

        // Standard: if no rows, add to rows; else add to columns
        const { rowVars, colVar } = useVelocityStore.getState().tableConfig;
        if (rowVars.length === 0) {
            useVelocityStore.getState().setTableConfig({ rowVars: [setId] });
        } else {
            useVelocityStore.getState().setTableConfig({ colVar: setId });
        }
    };

    const renderCellContent = () => {
        if (queryError && !isQuerying) {
            return (
                <motion.div
                    {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.enter, reducedMotion })}
                    className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-4 p-8 bg-[var(--status-error-surface)] border border-[var(--status-error-border)] text-center"
                    role="alert"
                >
                    <AlertCircle size={32} className="text-[var(--color-error)]" />
                    <motion.div {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.fast, reducedMotion })} className="space-y-1 max-w-md">
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
                    {/* Decorative background elements */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-20" />
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--bg-active)] border border-[var(--border-color)] shadow-sm">
                        <LayoutGrid size={32} className="text-[var(--color-accent)] opacity-80" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-base font-medium text-[var(--text-primary)]">Ready for Analysis</p>
                        <p className="text-sm">Drag or click variables to start building your view.</p>
                    </div>

                    {/* Smart Suggested Variables */}
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
                                        {...getMotionProps({ preset: 'fadeScale', duration: DURATIONS.fast, delay: i * 0.05, reducedMotion })}
                                        onClick={() => handleSuggestClick(s.setId)}
                                        className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-active)] border border-[var(--border-color)] hover:border-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent),transparent_92%)] transition-all text-left"
                                        title={s.reason}
                                    >
                                        <MousePointerClick size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--color-accent)] transition-colors shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]">{s.name}</span>
                                            <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[200px]">{s.reason}</span>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            );
        }

        // Use true slide state
        const contentType = activeSlide.visualizationType;

        switch (contentType) {
            case 'chart':
                // Use chart recommendation or cell override
                const recommendedType = chartRecommendation?.default || 'horizontal-bar';
                const config: AnalysisChartConfig = {
                    type: cell.content.chartType || recommendedType,
                    enableVisualETL: true
                };
                return (
                    <AnalysisOutputFrame
                        bodyPadding="chart"
                        density={tableDensity}
                        reducedMotion={reducedMotion}
                        bleed={focusMode}
                        className="h-full"
                    >
                        <AnalysisChart
                            data={chartData}
                            config={config}
                            rowVariables={resolvedRowVars}
                            colVariable={resolvedColVar}
                            isWeighted={isWeighted}
                            isMultipleResponse={isMultipleResponse}
                            variableStats={variableStats}
                        />
                    </AnalysisOutputFrame>
                );
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
                        isGrid={firstVarSet?.structure === 'grid'}
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
        <div className={`flex-1 flex flex-col items-center justify-center ${focusMode ? 'p-2' : 'p-6'} bg-glass-app overflow-y-auto ${className}`}>
            {/* 16:9 Presentation Canvas Container */}
            <div
                className="w-full max-w-[1200px] bg-[var(--mat-panel-bg,var(--bg-panel))] backdrop-blur-[var(--mat-panel-filter,0)] rounded-xl shadow-md border border-[var(--border-color)] overflow-hidden flex flex-col"
                style={{ aspectRatio: '16/9', minHeight: focusMode ? '640px' : '600px' }}
            >
                <div className={focusMode ? 'px-4 pt-4' : 'px-6 pt-6'}>
                    <SlideHeader className={focusMode ? 'compact' : ''} />
                </div>

                <div className={`flex-1 min-h-0 flex flex-col ${focusMode ? 'px-0 pb-2' : 'px-6 pb-6'}`}>
                    {renderCellContent()}
                </div>
            </div>
        </div>
    );
};
