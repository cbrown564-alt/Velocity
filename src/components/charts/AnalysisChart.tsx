import React, { useRef, useState, useEffect, useMemo } from 'react';
import { AggregatedRow } from '../../types';
import { BaseChartRendererProps, AnalysisChartConfig } from '../../types/charts';
import { CHART_PALETTE } from './shared/chartColors';
import {
    HorizontalBarRenderer,
    StackedBarRenderer,
    GroupedBarRenderer,
    DivergingBarRenderer,
    DonutRenderer,
    HistogramRenderer,
    LollipopRenderer,
    BoxPlotRenderer,
    GroupedBoxPlotRenderer,
    ViolinRenderer,
    RidgelineRenderer,
    HexbinRenderer
} from './renderers';
import { ProcessedAnalysisData } from '../../hooks/useProcessedAnalysisData';
import { ChartSelector } from './ChartSelector';
import { recommendChart } from '../../services/chartRecommender';
import { ChartLegend } from './shared/ChartLegend';
import { ChartType } from '../../types/charts';
import { useVelocityStore } from '../../store';

interface AnalysisChartProps {
    data: AggregatedRow[];
    config: AnalysisChartConfig;
    /** Pre-processed data with labels, sorting, etc. */
    processedData?: ProcessedAnalysisData | null;
    className?: string;
    /** Optional variable stats for histogram/distribution charts */
    variableStats?: any;
}

/**
 * Main wrapper for all analysis charts.
 * Handles sizing, color palette injection, and renderer selection.
 */
export const AnalysisChart: React.FC<AnalysisChartProps> = ({
    data,
    config,
    processedData,
    className = '',
    variableStats,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Get user-selected chart type from store
    const selectedChartType = useVelocityStore(state => state.selectedChartType);

    // Use selected type if available, otherwise fallback to recommender config
    const activeChartType = selectedChartType || config.type;

    // Derive available charts from context
    const recommendation = useMemo(() => {
        if (!processedData) return null;
        return recommendChart({
            rowVars: processedData.rowVariables,
            colVar: processedData.colVariable,
            isGrid: false, // TODO: detect grid
            isMultiResponse: processedData.isMultipleResponse,
        });
    }, [processedData]);

    // Simple resize observer
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const renderContent = () => {
        if (dimensions.width === 0 || dimensions.height === 0) {
            return null;
        }

        if (!processedData) {
            return (
                <div className="flex items-center justify-center h-full text-gray-400">
                    No data to display
                </div>
            );
        }

        // Common props for all renderers
        const commonProps = {
            width: dimensions.width,
            height: dimensions.height, // Subtract space for header/legend if needed, but flex layout handles it better
            colors: CHART_PALETTE,
            interactive: true,
            processedData,
            selectedKeys: config.selectedKeys,
            onSelectionChange: config.onSelectionChange,
            onContextMenu: config.onContextMenu,
            variableStats,
        };

        // TODO: Pass proper height accounting for toolbar

        switch (activeChartType) {
            case 'horizontal-bar':
                return <HorizontalBarRenderer {...commonProps} />;
            case 'stacked-bar':
            case 'stacked-bar-100':
                return <StackedBarRenderer {...commonProps} type={activeChartType} />;
            case 'grouped-bar':
                return <GroupedBarRenderer {...commonProps} />;
            case 'diverging-bar':
                return <DivergingBarRenderer {...commonProps} />;
            case 'donut':
                return <DonutRenderer {...commonProps} />;
            case 'histogram':
                return <HistogramRenderer {...commonProps} />;
            case 'vertical-bar':
                // Fallback to grouped for now or implement VerticalBarRenderer
                return <GroupedBarRenderer {...commonProps} />;
            case 'lollipop':
                return <LollipopRenderer {...commonProps} />;
            case 'box-plot':
                // Check if we have stats, if not try to use processedData series stats if available
                const boxStats = variableStats || (processedData?.series[0]?.stats ? { stats: processedData.series[0].stats } : undefined);
                return <BoxPlotRenderer {...commonProps} variableStats={boxStats} />;
            case 'grouped-box-plot':
                // If no explicit stats, try to infer from data if it's raw values (rare) or just pass through
                return <GroupedBoxPlotRenderer {...commonProps} />;
            case 'violin':
                return <ViolinRenderer {...commonProps} />;
            case 'ridgeline':
                return <RidgelineRenderer {...commonProps} />;
            case 'hexbin':
                return <HexbinRenderer {...commonProps} />;
            default:
                return (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        Chart type '{activeChartType}' not yet implemented
                    </div>
                );
        }
    };

    // Extract series for legend if available
    const legendItems = processedData?.series.map((s, i) => ({
        label: s.label,
        color: CHART_PALETTE[i % CHART_PALETTE.length]
    })) || [];

    return (
        <div className={`w-full h-full flex flex-col ${className}`}>
            {/* Toolbar / Header */}
            <div className="flex justify-between items-center mb-4 px-1">
                <div className="flex items-center gap-4">
                    <ChartSelector
                        currentType={activeChartType}
                        availableTypes={recommendation?.alternatives ? [recommendation.default, ...recommendation.alternatives] : undefined}
                        onSelect={(type) => useVelocityStore.getState().setSelectedChartType(type)}
                    />

                    {/* Bin Count Slider (Histogram Only) */}
                    {activeChartType === 'histogram' && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-md border border-gray-200">
                            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Bins</span>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="1"
                                defaultValue="10"
                                className="w-24 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                onMouseUp={(e) => {
                                    // Debounce by only firing on mouse up
                                    const value = parseInt((e.target as HTMLInputElement).value, 10);
                                    if (variableStats?.column) {
                                        useVelocityStore.getState().fetchVariableStats(variableStats.column, 'scale', value);
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>

                {config.showLegend && legendItems.length > 0 && (
                    <ChartLegend items={legendItems} />
                )}
            </div>

            {/* Chart Canvas */}
            <div
                ref={containerRef}
                className="flex-grow min-h-[300px] relative"
            >
                {renderContent()}
            </div>
        </div>
    );
};
