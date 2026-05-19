import React, { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { DataTable } from './DataTable';
import { SlideHeader } from './SlideHeader';
import { AnalysisChartConfig } from '../../../types/charts';
import { Variable } from '../../../types';

import { recommendChart } from '../../../services/chartRecommender';
import { useResolvedVariables } from '../hooks/useResolvedVariables';

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
    const totalCount = useVelocityStore((state) => state.dataset?.rowCount || 0);
    const isWeighted = useVelocityStore((state) => !!state.dataset?.weightVariable);
    const variableStats = useVelocityStore((state) => state.activeVariableStats);
    const tableStats = useVelocityStore((state) => state.tableStats);

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

    const renderCellContent = () => {
        if (resolvedRowVars.length === 0) {
            return (
                <div className="w-full h-full rounded-xl flex flex-col items-center justify-center text-[var(--text-secondary)] gap-5 bg-gradient-to-b from-[var(--bg-panel)] to-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] relative overflow-hidden">
                    {/* Decorative background elements */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-20" />
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--bg-active)] border border-[var(--border-color)] shadow-sm">
                        <LayoutGrid size={32} className="text-[var(--color-accent)] opacity-80" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-base font-medium text-[var(--text-primary)]">Ready for Analysis</p>
                        <p className="text-sm">Drag or click variables to start building your view.</p>
                    </div>
                </div>
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
                    <div className="w-full h-full p-4 flex flex-col">
                        <AnalysisChart
                            data={chartData}
                            config={config}
                            rowVariables={resolvedRowVars}
                            colVariable={resolvedColVar}
                            isWeighted={isWeighted}
                            isMultipleResponse={isMultipleResponse}
                            variableStats={variableStats}
                        />
                    </div>
                );
            case 'table':
                // Render legacy table - assuming it handles its own data fetching for now
                // In future, we pass props
                return (
                    <div className="w-full h-full overflow-hidden flex flex-col">
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
                        />
                    </div>
                );
            default:
                return <div>Unknown content type</div>;
        }
    };

    return (
        <div className={`flex-1 flex flex-col items-center justify-center p-8 bg-glass-app overflow-y-auto ${className}`}>
            {/* 16:9 Presentation Canvas Container */}
            <div
                className="w-full max-w-[1200px] bg-[var(--mat-panel-bg,var(--bg-panel))] backdrop-blur-[var(--mat-panel-filter,0)] rounded-xl shadow-md border border-[var(--border-color)] overflow-hidden flex flex-col"
                style={{ aspectRatio: '16/9', minHeight: '600px' }}
            >
                {/* Slide Header inside the Canvas */}
                <div className="px-8 pt-8">
                    <SlideHeader />
                </div>

                {/* Chart/Table Content */}
                <div className="flex-1 overflow-hidden px-4 pb-4">
                    {renderCellContent()}
                </div>
            </div>
        </div>
    );
};
