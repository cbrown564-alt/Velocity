import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { AggregatedRow } from '../../types';
import { BaseChartRendererProps, AnalysisChartConfig, ChartContextMenuEvent } from '../../types/charts';
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
import { ProcessedAnalysisData, ChartDataPoint } from '../../hooks/useProcessedAnalysisData';
import { ChartSelector } from './ChartSelector';
import { recommendChart } from '../../services/chartRecommender';
import { ChartLegend } from './shared/ChartLegend';
import { ChartType } from '../../types/charts';
import { useVelocityStore } from '../../store';
import { ChartContextMenu, ContextMenuOption } from '../overlays/ChartContextMenu';
import styles from './AnalysisChart.module.css';

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

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        position: { x: number; y: number };
        selectedItems: ChartDataPoint[];
    }>({
        isOpen: false,
        position: { x: 0, y: 0 },
        selectedItems: [],
    });

    // Get user-selected chart type from store
    const selectedChartType = useVelocityStore(state => state.selectedChartType);
    const addFilter = useVelocityStore(state => state.addFilter);

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

    // Handle context menu from chart renderers
    const handleContextMenu = useCallback((event: ChartContextMenuEvent) => {
        setContextMenu({
            isOpen: true,
            position: event.position,
            selectedItems: event.selected || [],
        });
    }, []);

    // Close context menu
    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Build context menu options based on selected items
    const contextMenuOptions = useMemo((): ContextMenuOption[] => {
        if (!processedData || contextMenu.selectedItems.length === 0) return [];

        const firstRowVar = processedData.rowVariables[0];
        if (!firstRowVar) return [];

        const selectedLabels = contextMenu.selectedItems.map(item => item.label).join(', ');
        const selectedValues = contextMenu.selectedItems.map(item => item.rawValue);

        const options: ContextMenuOption[] = [];

        // Filter to selection
        if (selectedValues.length === 1) {
            options.push({
                label: `Filter to "${contextMenu.selectedItems[0].label}"`,
                onClick: () => {
                    addFilter({
                        variableId: firstRowVar.id,
                        operator: 'eq',
                        value: selectedValues[0],
                    });
                },
            });
        } else if (selectedValues.length > 1) {
            options.push({
                label: `Filter to selected (${selectedValues.length} values)`,
                onClick: () => {
                    addFilter({
                        variableId: firstRowVar.id,
                        operator: 'in',
                        value: selectedValues,
                    });
                },
            });
        }

        // Exclude selection
        if (selectedValues.length === 1) {
            options.push({
                label: `Exclude "${contextMenu.selectedItems[0].label}"`,
                onClick: () => {
                    addFilter({
                        variableId: firstRowVar.id,
                        operator: 'neq',
                        value: selectedValues[0],
                    });
                },
                danger: true,
            });
        }

        return options;
    }, [processedData, contextMenu.selectedItems, addFilter]);

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
                <div className={styles.placeholder}>
                    No data to display
                </div>
            );
        }

        // Combined context menu handler - internal + external
        const combinedContextMenuHandler = (event: ChartContextMenuEvent) => {
            handleContextMenu(event);
            config.onContextMenu?.(event);
        };

        // Common props for all renderers
        const commonProps = {
            width: dimensions.width,
            height: dimensions.height,
            colors: CHART_PALETTE,
            interactive: true,
            processedData,
            selectedKeys: config.selectedKeys,
            onSelectionChange: config.onSelectionChange,
            onContextMenu: combinedContextMenuHandler,
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
                    <div className={styles.placeholder}>
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
        <div className={`${styles.container} ${className}`}>
            {/* Toolbar / Header */}
            <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                    <ChartSelector
                        currentType={activeChartType}
                        availableTypes={recommendation?.alternatives ? [recommendation.default, ...recommendation.alternatives] : undefined}
                        onSelect={(type) => useVelocityStore.getState().setSelectedChartType(type)}
                    />

                    {/* Bin Count Slider (Histogram Only) */}
                    {activeChartType === 'histogram' && (
                        <div className={styles.binControl}>
                            <span className={styles.binLabel}>Bins</span>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="1"
                                defaultValue="10"
                                className={styles.binSlider}
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
                className={styles.chartCanvas}
            >
                {renderContent()}
            </div>

            {/* Context Menu */}
            <ChartContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                title={contextMenu.selectedItems.length === 1
                    ? contextMenu.selectedItems[0].label
                    : contextMenu.selectedItems.length > 1
                        ? `${contextMenu.selectedItems.length} items selected`
                        : undefined
                }
                subtitle={contextMenu.selectedItems.length === 1
                    ? `${contextMenu.selectedItems[0].value.toLocaleString()} (${contextMenu.selectedItems[0].percent.toFixed(1)}%)`
                    : undefined
                }
                options={contextMenuOptions}
                onClose={closeContextMenu}
            />
        </div>
    );
};
