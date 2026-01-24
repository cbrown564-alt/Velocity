import React, { useRef, useState, useEffect } from 'react';
import { AggregatedRow } from '../../types';
import { BaseChartRendererProps, AnalysisChartConfig } from '../../types/charts';
import { CHART_PALETTE } from './shared/chartColors';
import { HorizontalBarRenderer } from './renderers/HorizontalBarRenderer';
import { StackedBarRenderer } from './renderers/StackedBarRenderer';
import { ProcessedAnalysisData } from '../../hooks/useProcessedAnalysisData';

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
            height: dimensions.height,
            colors: CHART_PALETTE,
            interactive: true,
            processedData,
        };

        switch (config.type) {
            case 'horizontal-bar':
                return <HorizontalBarRenderer {...commonProps} />;
            case 'stacked-bar':
            case 'stacked-bar-100':
                return <StackedBarRenderer {...commonProps} type={config.type} />;
            case 'grouped-bar':
                // Fallback to stacked until grouped is implemented
                return <StackedBarRenderer {...commonProps} type="stacked-bar" />;
            default:
                return (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        Chart type '{config.type}' not yet implemented
                    </div>
                );
        }
    };

    return (
        <div
            ref={containerRef}
            className={`w-full h-full min-h-[300px] relative ${className}`}
        >
            {renderContent()}
        </div>
    );
};
