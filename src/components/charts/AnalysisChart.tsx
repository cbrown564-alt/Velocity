import React, { useRef, useState, useEffect } from 'react';
import { AggregatedRow } from '../../types';
import { BaseChartRendererProps, AnalysisChartConfig } from '../../types/charts';
import { CHART_PALETTE } from './shared/chartColors';
import { HorizontalBarRenderer } from './renderers/HorizontalBarRenderer';
import { StackedBarRenderer } from './renderers/StackedBarRenderer';
import { ProcessedAnalysisData } from '../../hooks/useProcessedAnalysisData';
import { ChartSelector } from './ChartSelector';
import { ChartLegend } from './shared/ChartLegend';
import { ChartType } from '../../types/charts';
import { useVelocityStore } from '../../store';

interface AnalysisChartProps {
    data: AggregatedRow[];
    config: AnalysisChartConfig;
    /** Pre-processed data with labels, sorting, etc. */
    processedData?: ProcessedAnalysisData | null;
    className?: string;
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
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Get user-selected chart type from store
    const selectedChartType = useVelocityStore(state => state.selectedChartType);

    // Use selected type if available, otherwise fallback to recommender config
    const activeChartType = selectedChartType || config.type;

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
        };

        // TODO: Pass proper height accounting for toolbar

        switch (activeChartType) {
            case 'horizontal-bar':
                return <HorizontalBarRenderer {...commonProps} />;
            case 'stacked-bar':
            case 'stacked-bar-100':
                return <StackedBarRenderer {...commonProps} type={activeChartType} />;
            case 'grouped-bar':
                // Fallback to stacked until grouped is implemented
                return <StackedBarRenderer {...commonProps} type="stacked-bar" />;
            case 'vertical-bar':
            case 'histogram':
                // Use D3Histogram for now if available, or placeholder
                return (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        {activeChartType} renderer coming soon
                    </div>
                );
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
                <ChartSelector
                    currentType={activeChartType}
                    onSelect={(type) => useVelocityStore.getState().setSelectedChartType(type)}
                />

                {config.showLegend && legendItems.length > 0 && (
                    <ChartLegend items={legendItems} />
                )}
            </div>

            {/* Chart Canvas */}
            <div
                ref={containerRef}
                className="flex-grow min-h-0 relative"
            >
                {renderContent()}
            </div>
        </div>
    );
};
