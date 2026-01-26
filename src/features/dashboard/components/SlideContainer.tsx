import React, { useMemo } from 'react';
import { useVelocityStore } from '../../../store';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { DataTable } from './DataTable';
import { AnalysisChartConfig } from '../../../types/charts';
import { Variable } from '../../../types';
import { useProcessedAnalysisData } from '../../../hooks/useProcessedAnalysisData';
import { recommendChart } from '../../../services/chartRecommender';
import { useResolvedVariables } from '../hooks/useResolvedVariables';

interface SlideContainerProps {
    className?: string;
}

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
    const viewMode = useVelocityStore((state) => state.viewMode);
    const allVariables = useVelocityStore((state) => state.dataset?.variables || []);
    const totalCount = useVelocityStore((state) => state.dataset?.rowCount || 0);
    const isWeighted = useVelocityStore((state) => !!state.dataset?.weightVariable);
    const variableStats = useVelocityStore((state) => state.activeVariableStats);

    /**
     * Resolve VariableSet IDs to Variable objects.
     */
    const { resolvedRowVars, resolvedColVar, firstRowVarSet: firstVarSet } = useResolvedVariables();

    // Check if first row variable set is a multiple response
    const isMultipleResponse = firstVarSet?.structure === 'multiple';

    // Process data through shared hook
    const processedData = useProcessedAnalysisData({
        data: chartData,
        rowVariables: resolvedRowVars,
        colVariable: resolvedColVar,
        isWeighted,
        isMultipleResponse,
    });

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
        return <div className="p-4 text-gray-500">No active slide</div>;
    }

    // Focus mode logic: Render the first cell full screen
    const cell = activeSlide.cells[0];
    if (!cell) {
        return <div className="p-4 text-gray-500">Empty slide</div>;
    }

    const renderCellContent = () => {
        // Use global viewMode for MVP backward compatibility, falling back to cell type
        const contentType = viewMode || cell.content.type;

        switch (contentType) {
            case 'chart':
                // Use chart recommendation or cell override
                const recommendedType = chartRecommendation?.default || 'horizontal-bar';
                const config: AnalysisChartConfig = {
                    type: cell.content.chartType || recommendedType,
                    enableVisualETL: true
                };
                return (
                    <div className="w-full h-full min-h-[400px] p-4 bg-[var(--bg-panel)] rounded-lg shadow-sm border border-[var(--border-color)]">
                        <AnalysisChart
                            data={chartData}
                            config={config}
                            processedData={processedData}
                            variableStats={variableStats}
                        />
                    </div>
                );
            case 'table':
                // Render legacy table - assuming it handles its own data fetching for now
                // In future, we pass props
                return (
                    <div className="w-full h-full bg-[var(--bg-panel)] rounded-lg shadow-sm border border-[var(--border-color)] overflow-hidden">
                        <DataTable
                            data={chartData}
                            rowVariables={resolvedRowVars}
                            colVariable={resolvedColVar}
                            totalCount={totalCount}
                            isWeighted={isWeighted}
                            variableStats={variableStats}
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
        <div className={`flex-1 flex flex-col h-full bg-[var(--bg-app)] ${className}`}>
            {/* Slide Header (Title) could go here */}
            <div className="flex-1 overflow-hidden p-4">
                {renderCellContent()}
            </div>
        </div>
    );
};
