import React, { useMemo, useRef, useState, useEffect } from 'react';
import { AggregatedRow } from '../../types';
import { ChartType, BaseChartRendererProps, AnalysisChartConfig } from '../../types/charts';
import { CHART_PALETTE } from './shared/chartColors';
import { HorizontalBarRenderer } from './renderers/HorizontalBarRenderer';
import { StackedBarRenderer } from './renderers/StackedBarRenderer';
import { useResizeObserver } from '../../hooks/useResizeObserver';

interface AnalysisChartProps {
    data: AggregatedRow[];
    config: AnalysisChartConfig;
    className?: string;
}

/**
 * Main wrapper for all analysis charts.
 * Handles sizing, color palette injection, and renderer selection.
 */
export const AnalysisChart: React.FC<AnalysisChartProps> = ({
    data,
    config,
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Simple resize observer if not available elsewhere
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

    const rendererProps: BaseChartRendererProps<AggregatedRow> = {
        data,
        width: dimensions.width,
        height: dimensions.height,
        colors: CHART_PALETTE,
        interactive: true, // Default to true
    };

    const renderContent = () => {
        if (dimensions.width === 0 || dimensions.height === 0) {
            return null;
        }

        switch (config.type) {
            case 'horizontal-bar':
                return <HorizontalBarRenderer {...rendererProps} />;
            case 'stacked-bar':
            case 'stacked-bar-100': // StackedBarRenderer can handle both
                return <StackedBarRenderer {...rendererProps} type={config.type} />;
            case 'grouped-bar': // StackedBarRenderer or separate GroupedBarRenderer
                // For Phase 2 startup, we might want to map grouped to stacked or have a placeholder
                // Using StackedBarRenderer temporarily if it supports grouping or just fallback
                return <StackedBarRenderer {...rendererProps} type="stacked-bar" />; // Fallback until Grouped is ready
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
