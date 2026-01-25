import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { AggregatedRow } from '../../types';
import { BaseChartRendererProps, AnalysisChartConfig, ChartContextMenuEvent, MergeEvent } from '../../types/charts';
import { CHART_PALETTE } from './shared/chartColors';
import {
    HorizontalBarRenderer,
    VerticalBarRenderer,
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
import { InputModal } from '../overlays/InputModal';
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

    // Label Mode State
    const [labelMode, setLabelMode] = useState<'count' | 'percent' | 'none'>('count');

    // Merge modal state (Visual ETL)
    const [mergeModal, setMergeModal] = useState<{
        isOpen: boolean;
        sourceItems: ChartDataPoint[];
        targetItem: ChartDataPoint | null;
    }>({
        isOpen: false,
        sourceItems: [],
        targetItem: null,
    });

    // Get user-selected chart type from store
    const selectedChartType = useVelocityStore(state => state.selectedChartType);
    const addFilter = useVelocityStore(state => state.addFilter);
    const recodeVariable = useVelocityStore(state => state.recodeVariable);

    // Check if Visual ETL is enabled
    const enableVisualETL = config.enableVisualETL ?? true;

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

    // Data Transformation for Diverging Bar
    // Standard: Rows = Categories, Col = Total
    // Grid/Pivot: Rows = Scale Points, Cols = Items => NEED TO SWAP
    // We want Rows = Items, Segments = Scale Points
    const chartData = useMemo(() => {
        if (!processedData) return null;

        if (activeChartType === 'diverging-bar') {
            // CASE 1: Single Variable (Pivot Categories to Segments)
            // If we have 1 column (Total) and multiple Rows (Categories)
            if (processedData.columns.length === 1 && processedData.rows.length > 1) {
                // Create specific columns from the rows (Scale Points)
                const newColumns = processedData.rows.map(r => ({
                    key: r.rawValue,
                    label: r.label,
                    total: r.total
                }));

                // Create a single row for the variable
                const mainVar = processedData.rowVariables[0];
                const newRow: any = {
                    key: mainVar?.id || 'root',
                    label: mainVar?.label || 'Distribution',
                    rawValue: mainVar?.id || 'root',
                    total: processedData.grandTotal,
                    cells: {}
                };

                // Map counts to the new cells
                processedData.rows.forEach(r => {
                    // The cell value comes from the 'Total' column of the original row
                    const originalCell = r.cells[processedData.columns[0].key];
                    if (originalCell) {
                        newRow.cells[r.rawValue] = originalCell;
                    }
                });

                return {
                    ...processedData,
                    columns: newColumns,
                    rows: [newRow],
                    series: newColumns.map(col => ({
                        key: col.key,
                        label: col.label,
                        data: [{
                            label: newRow.label,
                            rawValue: newRow.rawValue,
                            value: newRow.cells[col.key]?.count || 0,
                            percent: newRow.cells[col.key]?.percent || 0,
                            sig: newRow.cells[col.key]?.sig,
                        }]
                    }))
                };
            }

            // CASE 2: Grid Variable (Dimensions are inverted for visualization)
            // Current: Rows = Scale Points (1..10), Columns = Items (Content, Energy...)
            // Target: Rows = Items, Segments = Scale Points
            if (processedData.columns.length > 1 && processedData.rows.length > 1) {
                // 1. New Columns = Old Rows (The Scale Points)
                const newColumns = processedData.rows.map(r => ({
                    key: r.rawValue,
                    label: r.label,
                    total: r.total
                }));

                // 2. New Rows = Old Columns (The Items)
                const newRows = processedData.columns.map(col => {
                    const newRow: any = {
                        key: col.key,
                        label: col.label,
                        rawValue: col.key,
                        total: col.total,
                        cells: {}
                    };

                    // Fill cells: For each Scale Point (Old Row), get the data for this Item (Old Col)
                    processedData.rows.forEach(oldRow => {
                        const cell = oldRow.cells[col.key];
                        if (cell) {
                            newRow.cells[oldRow.rawValue] = cell;
                        }
                    });

                    return newRow;
                });

                // 3. New Series = Old Rows (The Scale Points mapped to the new items)
                const newSeries = newColumns.map(newCol => ({
                    key: newCol.key,
                    label: newCol.label,
                    data: newRows.map(row => ({
                        label: row.label,
                        rawValue: row.rawValue,
                        value: row.cells[newCol.key]?.count || 0,
                        percent: row.cells[newCol.key]?.percent || 0,
                        sig: row.cells[newCol.key]?.sig
                    }))
                }));

                return {
                    ...processedData,
                    columns: newColumns,
                    rows: newRows,
                    series: newSeries
                };
            }
        }

        return processedData;
    }, [processedData, activeChartType]);

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

        setMergeModal({
            isOpen: true,
            sourceItems: event.sourceItems,
            targetItem: event.targetItem,
        });
    }, [enableVisualETL]);

    // Handle merge confirmation
    const handleMergeConfirm = useCallback(async (groupName: string) => {
        if (!chartData || !mergeModal.targetItem) return;

        const firstRowVar = chartData.rowVariables[0];
        if (!firstRowVar) return;

        // Build mappings: all source items + target item map to the new group name
        const mappings: Record<string, string> = {};
        mergeModal.sourceItems.forEach(item => {
            mappings[item.rawValue] = groupName;
        });
        mappings[mergeModal.targetItem.rawValue] = groupName;

        try {
            // Create a recoded variable with the merge
            await recodeVariable(
                firstRowVar.id,
                `${firstRowVar.label} (Grouped)`,
                {
                    mode: 'categorical',
                    mappings,
                }
            );
        } catch (e) {
            console.error('Failed to create merged group:', e);
        }

        setMergeModal({ isOpen: false, sourceItems: [], targetItem: null });
    }, [chartData, mergeModal, recodeVariable]);

    // Open merge modal from context menu
    const openMergeFromSelection = useCallback(() => {
        if (contextMenu.selectedItems.length < 2) return;

        // Use first item as target, rest as sources
        const [target, ...sources] = contextMenu.selectedItems;
        setMergeModal({
            isOpen: true,
            sourceItems: sources,
            targetItem: target,
        });
        closeContextMenu();
    }, [contextMenu.selectedItems, closeContextMenu]);

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

        if (!chartData) {
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
            processedData: chartData,
            selectedKeys: config.selectedKeys,
            onSelectionChange: config.onSelectionChange,
            onContextMenu: enableVisualETL ? combinedContextMenuHandler : undefined,
            onMerge: enableVisualETL ? handleMerge : undefined,
            variableStats,
            labelMode,
        };

        // TODO: Pass proper height accounting for toolbar

        switch (activeChartType) {
            case 'horizontal-bar':
                return <HorizontalBarRenderer {...commonProps} />;
            case 'stacked-bar':
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
                return <VerticalBarRenderer {...commonProps} />;
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
    const legendItems = chartData?.series.map((s, i) => ({
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

                {/* Label Toggle */}
                <div className={styles.labelToggle}>
                    <button
                        className={`${styles.toggleButton} ${labelMode === 'count' ? styles.active : ''}`}
                        onClick={() => setLabelMode('count')}
                        title="Show Count"
                    >
                        #
                    </button>
                    <button
                        className={`${styles.toggleButton} ${labelMode === 'percent' ? styles.active : ''}`}
                        onClick={() => setLabelMode('percent')}
                        title="Show Percent"
                    >
                        %
                    </button>
                    <button
                        className={`${styles.toggleButton} ${labelMode === 'none' ? styles.active : ''}`}
                        onClick={() => setLabelMode('none')}
                        title="Hide Labels"
                    >
                        ∅
                    </button>
                </div>
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

            {/* Merge Group Modal (Visual ETL) */}
            <InputModal
                isOpen={mergeModal.isOpen}
                onClose={() => setMergeModal({ isOpen: false, sourceItems: [], targetItem: null })}
                onSubmit={handleMergeConfirm}
                title="Create Group"
                placeholder="Enter group name..."
                initialValue={mergeModal.targetItem?.label || ''}
                submitLabel="Create Group"
            />
        </div>
    );
};
