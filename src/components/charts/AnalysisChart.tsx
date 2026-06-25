import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { AggregatedRow } from '../../types';
import { BaseChartRendererProps, AnalysisChartConfig, ChartContextMenuEvent, MergeEvent } from '../../types/charts';
import { CHART_PALETTE } from './shared/chartColors';
import {
    HorizontalBarRenderer,
    VerticalBarRenderer,
    StackedBarRenderer,
    GroupedBarRenderer,
    GroupedColumnRenderer,
    DivergingBarRenderer,
    DonutRenderer,
    HistogramRenderer,
    LollipopRenderer,
    BoxPlotRenderer,
    GroupedBoxPlotRenderer,
    ViolinRenderer,
    RidgelineRenderer,
    HexbinRenderer,
    ScatterPlotRenderer
} from './renderers';
import { ProcessedAnalysisData, ChartDataPoint, ChartSeries } from '../../types/processedData';
import { ChartSelector } from './ChartSelector';
import { recommendChart } from '../../core/visualization/chartRecommender';
import { resolveMetricChartType } from '../../core/visualization/chartTypeResolver';
import { transformChartData } from '../../services/chartDataTransformer';
import { ChartLegend } from './shared/ChartLegend';
import { ChartType } from '../../types/charts';
import { useVelocityStore } from '../../store';
import { ChartContextMenu, ContextMenuOption } from '../overlays/ChartContextMenu';
import { InputModal } from '../overlays/InputModal';
import { Variable } from '../../types';
import { useProcessedAnalysisData } from '../../hooks/useProcessedAnalysisData';
import { useMergeOrchestration } from '../../hooks/useMergeOrchestration';
import styles from './AnalysisChart.module.css';
import { ArrowLeftRight, RotateCcw } from 'lucide-react';

interface AnalysisChartProps {
    data: AggregatedRow[];
    config: AnalysisChartConfig;
    /** Metadata props required for data processing */
    rowVariables: Variable[];
    colVariable: Variable | null;
    isWeighted?: boolean;
    isMultipleResponse?: boolean;
    className?: string;
    /** Optional variable stats for histogram/distribution charts */
    variableStats?: any;
    /** Optional initial processed data (fallback/optimization) */
    initialProcessedData?: ProcessedAnalysisData | null;
}

/**
 * Main wrapper for all analysis charts.
 * Handles sizing, color palette injection, and renderer selection.
 */
export const AnalysisChart: React.FC<AnalysisChartProps> = ({
    data,
    config,
    rowVariables,
    colVariable,
    isWeighted = false,
    isMultipleResponse = false,
    className = '',
    variableStats,
    initialProcessedData,
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

    // Label Mode State
    const [labelMode, setLabelMode] = useState<'count' | 'percent' | 'none'>('count');

    // Get active slide to read visual state
    const activeSlideId = useVelocityStore(state => state.activeSlideId);
    const activeSlide = useVelocityStore(state => state.slides.find(s => s.id === activeSlideId));

    // Get user-selected chart type from active slide instead of global state
    const selectedChartType = activeSlide?.chartType;
    const addFilter = useVelocityStore(state => state.addFilter);

    // Check if Visual ETL is enabled
    const enableVisualETL = config.enableVisualETL ?? true;

    // Shared merge orchestration (modal state + recode flow)
    const firstRowVarId = rowVariables[0]?.id;
    const { mergeModal, openMerge, closeMerge, confirmMerge } = useMergeOrchestration(firstRowVarId);

    // Use selected type if available, otherwise fallback to recommender config
    const activeChartType = selectedChartType || config.type;

    // Fetch processed and transformed data from worker
    const chartData = useProcessedAnalysisData({
        data,
        rowVariables,
        colVariable,
        isWeighted,
        isMultipleResponse,
        chartType: activeChartType
    });

    const effectiveChartType = useMemo(
        () => resolveMetricChartType(activeChartType, chartData),
        [activeChartType, chartData],
    );

    const displayChartData = useMemo(() => {
        if (!chartData) return null;
        if (effectiveChartType === activeChartType) return chartData;
        return transformChartData(chartData, effectiveChartType) ?? chartData;
    }, [chartData, activeChartType, effectiveChartType]);

    // Derive available charts from context
    const recommendation = useMemo(() => {
        if (!rowVariables.length) return null;
        return recommendChart({
            rowVars: rowVariables,
            colVar: colVariable,
            isGrid: rowVariables.some(v => v.synthetic && v.sourceGridId),
            isMultiResponse: isMultipleResponse,
        });
    }, [rowVariables, colVariable, isMultipleResponse]);

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

    // Handle merge from drag-to-merge
    const handleMerge = useCallback((event: MergeEvent) => {
        if (!enableVisualETL) return;
        openMerge(event);
    }, [enableVisualETL, openMerge]);

    // Open merge modal from context menu
    const openMergeFromSelection = useCallback(() => {
        if (contextMenu.selectedItems.length < 2) return;

        const [target, ...sources] = contextMenu.selectedItems;
        openMerge({ sourceItems: sources, targetItem: target });
        closeContextMenu();
    }, [contextMenu.selectedItems, closeContextMenu, openMerge]);

    // Build context menu options based on selected items
    const contextMenuOptions = useMemo((): ContextMenuOption[] => {
        if (!chartData || contextMenu.selectedItems.length === 0) return [];

        const firstRowVar = chartData.rowVariables[0];
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

        // Create Group (Visual ETL) - available when 2+ items selected
        if (enableVisualETL && selectedValues.length >= 2) {
            options.push({
                label: `Create Group (${selectedValues.length} values)...`,
                onClick: openMergeFromSelection,
            });
        }

        return options;
    }, [chartData, contextMenu.selectedItems, addFilter, enableVisualETL, openMergeFromSelection]);

    const measureContainer = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        if (width > 0 && height > 0) {
            setDimensions((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height },
            );
        }
    }, []);

    // Simple resize observer + initial measure (chart mode can mount before layout settles)
    useEffect(() => {
        if (!containerRef.current) return;

        measureContainer();
        const raf = requestAnimationFrame(measureContainer);

        const observer = new ResizeObserver(() => {
            measureContainer();
        });

        observer.observe(containerRef.current);
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
        };
    }, [measureContainer, effectiveChartType, displayChartData]);

    const renderContent = () => {
        if (dimensions.width === 0 || dimensions.height === 0) {
            return null;
        }

        if (!displayChartData) {
            return (
                <div className={styles.placeholder} role="status" aria-live="polite">
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
            processedData: displayChartData,
            selectedKeys: config.selectedKeys,
            onSelectionChange: config.onSelectionChange,
            onContextMenu: enableVisualETL ? combinedContextMenuHandler : undefined,
            onMerge: enableVisualETL ? handleMerge : undefined,
            variableStats,
            labelMode,
        };

        // TODO: Pass proper height accounting for toolbar

        switch (effectiveChartType) {
            case 'horizontal-bar':
                return <HorizontalBarRenderer {...commonProps} />;
            case 'stacked-bar':
                return <StackedBarRenderer {...commonProps} type="stacked-bar" />;
            case 'grouped-bar':
                return <GroupedBarRenderer {...commonProps} />;
            case 'grouped-column':
                return <GroupedColumnRenderer {...commonProps} />;
            case 'diverging-bar':
                return <DivergingBarRenderer {...commonProps} />;
            case 'donut':
                return <DonutRenderer {...commonProps} />;
            case 'histogram':
                return <HistogramRenderer {...commonProps} />;
            case 'vertical-bar':
                return <VerticalBarRenderer {...commonProps} />;
            case 'lollipop':
                return <LollipopRenderer {...commonProps} />;
            case 'box-plot': {
                const boxStats = variableStats || (displayChartData?.series[0]?.stats ? { stats: displayChartData.series[0].stats } : undefined);
                return <BoxPlotRenderer {...commonProps} variableStats={boxStats} />;
            }
            case 'grouped-box-plot':
                return <GroupedBoxPlotRenderer {...commonProps} />;
            case 'violin':
                return <ViolinRenderer {...commonProps} />;
            case 'ridgeline':
                return <RidgelineRenderer {...commonProps} />;
            case 'hexbin':
                return <HexbinRenderer {...commonProps} />;
            case 'scatter':
                return <ScatterPlotRenderer {...commonProps} />;
            default: {
                const unhandledType: never = effectiveChartType;
                return (
                    <div className={styles.placeholder}>
                        Chart type '{unhandledType}' not yet implemented
                    </div>
                );
            }
        }
    };

    // Extract series for legend if available
    const legendItems = displayChartData?.series.map((s, i) => ({
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
                        onSelect={(type) => {
                            if (activeSlideId) {
                                useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'chart', type);
                            }
                        }}
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
                                        useVelocityStore.getState().fetchVariableStats(variableStats.column, 'numeric', value);
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>

                {config.showLegend && legendItems.length > 0 && (
                    <ChartLegend items={legendItems} />
                )}
                {config.showLegend && legendItems.length > 0 && (
                    <ChartLegend items={legendItems} />
                )}

                <div className="flex gap-2">
                    {/* Row/Col Actions */}
                    <div className={styles.labelToggle} role="group" aria-label="Data Actions">
                        <button
                            className={styles.toggleButton}
                            onClick={useVelocityStore.getState().swapAxes}
                            title="Swap Rows and Columns"
                            aria-label="Swap Rows and Columns"
                        >
                            <ArrowLeftRight size={14} />
                        </button>
                        <button
                            className={styles.toggleButton}
                            onClick={useVelocityStore.getState().clearConfiguration}
                            title="Clear Analysis"
                            aria-label="Clear Analysis"
                        >
                            <RotateCcw size={14} />
                        </button>
                    </div>

                    {/* Label Toggle */}
                    <div className={styles.labelToggle} role="group" aria-label="Label mode">
                        <button
                            className={`${styles.toggleButton} ${labelMode === 'count' ? styles.active : ''}`}
                            onClick={() => setLabelMode('count')}
                            title="Show Count"
                            aria-label="Show Count"
                            aria-pressed={labelMode === 'count'}
                        >
                            #
                        </button>
                        <button
                            className={`${styles.toggleButton} ${labelMode === 'percent' ? styles.active : ''}`}
                            onClick={() => setLabelMode('percent')}
                            title="Show Percent"
                            aria-label="Show Percent"
                            aria-pressed={labelMode === 'percent'}
                        >
                            %
                        </button>
                        <button
                            className={`${styles.toggleButton} ${labelMode === 'none' ? styles.active : ''}`}
                            onClick={() => setLabelMode('none')}
                            title="Hide Labels"
                            aria-label="Hide Labels"
                            aria-pressed={labelMode === 'none'}
                        >
                            ∅
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart Canvas */}
            <div
                ref={containerRef}
                className={styles.chartCanvas}
                role="img"
                aria-label={displayChartData ? `Chart showing ${displayChartData.rowVariables.map(v => v.label).join(', ')}` : 'Analysis chart'}
            >
                {renderContent()}
            </div>

            {/* Screen-reader accessible data table (visually hidden) */}
            {displayChartData && (
                <ChartScreenReaderTable data={displayChartData} />
            )}

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

            {/* Merge Group Modal (Visual ETL) */}
            <InputModal
                isOpen={mergeModal.isOpen}
                onClose={closeMerge}
                onSubmit={confirmMerge}
                title="Create Group"
                placeholder="Enter group name..."
                initialValue={mergeModal.targetItem?.label || ''}
                submitLabel="Create Group"
            />
        </div >
    );
};

/**
 * Screen-reader accessible data table for charts.
 * Renders a visually hidden HTML table with the same data as the chart
 * so that screen-reader users can access the underlying numbers.
 */
export const ChartScreenReaderTable: React.FC<{ data: ProcessedAnalysisData }> = ({ data }) => {
    const headers = data.columns.map(c => c.label);
    const hasMultipleCols = data.columns.length > 1;

    return (
        <table className="sr-only">
            <caption>
                Data table for {data.rowVariables.map(v => v.label).join(', ')}
                {data.colVariable ? ` by ${data.colVariable.label}` : ''}
            </caption>
            <thead>
                <tr>
                    <th scope="col">{data.rowVariables[0]?.label ?? 'Category'}</th>
                    {headers.map(h => (
                        <th key={h} scope="col">{h}</th>
                    ))}
                    {hasMultipleCols && <th scope="col">Total</th>}
                </tr>
            </thead>
            <tbody>
                {data.series[0]?.data.map((point, idx) => (
                    <tr key={point.rawValue}>
                        <th scope="row">{point.label}</th>
                        {data.series.map((series) => {
                            const cell = series.data[idx];
                            return (
                                <td key={series.key}>
                                    {cell
                                        ? `${cell.value.toLocaleString()} (${cell.percent.toFixed(1)}%)`
                                        : '—'}
                                </td>
                            );
                        })}
                        {hasMultipleCols && (
                            <td>
                                {data.series.reduce((sum, s) => {
                                    const cell = s.data[idx];
                                    return sum + (cell?.value ?? 0);
                                }, 0).toLocaleString()}
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
