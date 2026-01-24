/**
 * VariableInspector Component
 *
 * Column 5 in the Miller Column navigation.
 * Displays full metadata and distribution for the selected variable.
 * Shows real distribution data from DuckDB queries.
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Tag, Hash, BarChart2, Info, AlertTriangle, CheckCircle, Type, Calendar } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../services/analysisWorker';
import { D3BarChart, BarDatum, SelectionEvent, D3Histogram, BinData, BinSelectionEvent } from '../../components/charts';
import { HorizontalBarRenderer, HistogramRenderer } from '../../components/charts/renderers';
import { ChartContextMenu } from '../../components/overlays/ChartContextMenu';
import { InputModal } from '../../components/overlays/InputModal';
import styles from './VariableInspector.module.css';

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'nominal':
            return <Tag size={14} />;
        case 'ordinal':
            return <BarChart2 size={14} />;
        case 'scale':
            return <Hash size={14} />;
        case 'text':
            return <Type size={14} />;
        case 'date':
            return <Calendar size={14} />;
        default:
            return <Tag size={14} />;
    }
};

const getTypeBadgeClass = (type: string) => {
    switch (type) {
        case 'nominal':
            return styles.typeBadgeNominal;
        case 'ordinal':
            return styles.typeBadgeOrdinal;
        case 'scale':
            return styles.typeBadgeScale;
        case 'text':
            return styles.typeBadgeText;
        case 'date':
            return styles.typeBadgeDate;
        default:
            return styles.typeBadgeNominal;
    }
};

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'nominal':
            return 'Categorical';
        case 'ordinal':
            return 'Ordinal';
        case 'scale':
            return 'Numeric';
        case 'text':
            return 'Text';
        case 'date':
            return 'Date';
        default:
            return type;
    }
};

interface VariableInspectorProps {
    className?: string;
}

// Context menu state for chart interactions
interface ContextMenuState {
    isOpen: boolean;
    position: { x: number; y: number };
    selected: any[]; // Allow generic items (BarDatum or BinData with metadata)
}

export const VariableInspector: React.FC<VariableInspectorProps> = ({ className }) => {
    const {
        dataset,
        selectedVariableId,
        getVariableStats,
        variableStats,
        variableStatsLoading,
        recodeVariable,
        getUniqueValues,
    } = useVelocityStore();

    // Context menu state for chart interactions
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        position: { x: 0, y: 0 },
        selected: [],
    });

    // Close context menu
    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    }, []);

    // State for group name input modal
    const [showGroupNameModal, setShowGroupNameModal] = useState(false);
    const [pendingGroupSelection, setPendingGroupSelection] = useState<BarDatum[]>([]);
    const [pendingBinSelection, setPendingBinSelection] = useState<BinData[]>([]);
    const [isCreatingRecode, setIsCreatingRecode] = useState(false);


    // State for histogram context menu
    const [histogramContextMenu, setHistogramContextMenu] = useState<{
        isOpen: boolean;
        position: { x: number; y: number };
        selected: BinData[];
    }>({
        isOpen: false,
        position: { x: 0, y: 0 },
        selected: [],
    });

    // State for chart selection
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [selectedBins, setSelectedBins] = useState<Set<string>>(new Set()); // Store bin labels or IDs

    // Get the selected variable
    const variable = useMemo((): Variable | null => {
        if (!selectedVariableId || !dataset) return null;
        return dataset.variables.find(v => v.id === selectedVariableId) || null;
    }, [selectedVariableId, dataset]);

    // Get stats for the selected variable
    const stats: VariableStatsResult | null = selectedVariableId
        ? variableStats[selectedVariableId] || null
        : null;
    const isLoadingStats = selectedVariableId
        ? variableStatsLoading[selectedVariableId] || false
        : false;

    // Reset selection when variable changes
    useEffect(() => {
        setSelectedKeys(new Set());
        setSelectedBins(new Set());
    }, [selectedVariableId]);

    // Fetch stats when variable is selected
    useEffect(() => {
        if (!selectedVariableId || isLoadingStats) return;

        const needsStats = !stats;
        const needsNumericStats = variable?.type === 'scale' && stats && !stats.numeric;

        if (needsStats || needsNumericStats) {
            getVariableStats(selectedVariableId).catch(err => {
                console.warn('[VariableInspector] Failed to fetch stats:', err);
            });
        }
    }, [selectedVariableId, stats, isLoadingStats, getVariableStats, variable?.type]);

    // Calculate derived stats
    const completenessPercent = stats && stats.totalCount > 0
        ? ((stats.totalCount - stats.missingCount) / stats.totalCount) * 100
        : null;
    const missingPercent = stats && stats.totalCount > 0
        ? (stats.missingCount / stats.totalCount) * 100
        : null;

    // Check if variable is numeric/scale type and has numeric stats
    const isNumericVariable = variable?.type === 'scale';
    const numericStats = stats?.numeric;

    // Prepare data for Nominal/Ordinal Charts (HorizontalBarRenderer)
    const nominalChartData = useMemo(() => {
        if (!stats || !variable || isNumericVariable) return null;
        const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;

        const data = stats.frequencies.map((freq) => {
            const label = hasValueLabels
                ? variable.valueLabels.find(vl => vl.value === freq.value)?.label || String(freq.value)
                : String(freq.value);

            return {
                label,
                value: freq.count,
                percent: (freq.count / stats.totalCount) * 100,
                code: freq.value,
            };
        });

        return {
            series: [{
                id: 'default',
                label: 'Count',
                data,
            }],
            colors: ['var(--color-terracotta)'],
        } as any; // Type assertion as partial ProcessedAnalysisData
    }, [stats, variable, isNumericVariable]);

    // Prepare data for Histogram (HistogramRenderer)
    const histogramData = useMemo(() => {
        if (!numericStats || !variable || !isNumericVariable) return null;

        const data = numericStats.histogramBins.map(bin => ({
            label: `${bin.x0} - ${bin.x1}`,
            value: bin.count,
            percent: (bin.count / (stats?.totalCount || 1)) * 100,
            // Metadata for parsing in renderer if needed, though label parsing handles it
            rawValue: String(bin.x0),
            originalBin: bin
        }));

        return {
            rows: data, // HistogramRenderer expects 'rows' directly in processedData usually? No, it extracts from series or rows
            // Wait, BaseChartRendererProps processedData type has 'rows' and 'series'.
            // Let's populate 'rows' for HistogramRenderer as per its implementation
            series: [{
                id: 'default',
                label: 'Frequency',
                data
            }]
        } as any;
    }, [numericStats, variable, isNumericVariable, stats]);

    // Handle generic chart context menu
    const handleContextMenu = useCallback((event: { selected: any[]; position: { x: number; y: number } }) => {
        if (event.selected.length === 0) return;

        setContextMenu({
            isOpen: true,
            position: event.position,
            selected: event.selected,
        });
    }, []);

    // Handle context menu actions - show modal to get group name
    const handleCreateGroup = useCallback(() => {
        if (contextMenu.selected.length > 0 && variable) {
            // Determine if we are grouping bins (histogram) or categories (bar) based on data shape
            const isBinData = contextMenu.selected.some(d => d.originalBin); // Check for marker we added

            if (isBinData) {
                setPendingBinSelection(contextMenu.selected.map(d => d.originalBin)); // Extract original bins
                setPendingGroupSelection([]);
            } else {
                setPendingGroupSelection([...contextMenu.selected]);
                setPendingBinSelection([]);
            }
            setShowGroupNameModal(true);
        }
        closeContextMenu();
    }, [contextMenu.selected, variable, closeContextMenu]);

    // Handle group name submission - create the recode
    const handleGroupNameSubmit = useCallback(async (groupName: string) => {
        if (!variable) return;

        // Check if this is a binning recode (from histogram) or categorical (from bar chart)
        const isBinning = pendingBinSelection.length > 0;

        if (!isBinning && pendingGroupSelection.length === 0) return;

        setIsCreatingRecode(true);
        try {
            if (isBinning) {
                // Create binning recode from histogram bins
                // Sort bins by x0 to ensure proper ordering
                const sortedBins = [...pendingBinSelection].sort((a, b) => a.x0 - b.x0);
                const minVal = sortedBins[0].x0;
                const maxVal = sortedBins[sortedBins.length - 1].x1;

                const rules = [{
                    min: minVal,
                    max: maxVal,
                    label: groupName,
                }];

                const newVarName = `${variable.name}_binned`;
                await recodeVariable(variable.id, newVarName, {
                    mode: 'binning',
                    rules,
                });

                console.log('[VariableInspector] Created binning recode:', {
                    source: variable.name,
                    newVar: newVarName,
                    groupName,
                    range: `${minVal} - ${maxVal}`,
                });

                setPendingBinSelection([]);
            } else {
                // Categorical recode from bar chart
                const allValues = await getUniqueValues(variable.id);

                const mappings: Record<string, string> = {};
                const selectedCodes = new Set(pendingGroupSelection.map(d => String(d.code)));

                for (const val of allValues) {
                    if (selectedCodes.has(String(val))) {
                        mappings[val] = groupName;
                    } else {
                        mappings[val] = val;
                    }
                }

                const newVarName = `${variable.name}_grouped`;
                await recodeVariable(variable.id, newVarName, {
                    mode: 'categorical',
                    mappings,
                });

                console.log('[VariableInspector] Created categorical recode:', {
                    source: variable.name,
                    newVar: newVarName,
                    groupName,
                    groupedValues: pendingGroupSelection.map(d => d.label),
                });

                setPendingGroupSelection([]);
            }
        } catch (error) {
            console.error('[VariableInspector] Failed to create recode:', error);
        } finally {
            setIsCreatingRecode(false);
        }
    }, [variable, pendingGroupSelection, pendingBinSelection, getUniqueValues, recodeVariable]);


    // If no variable selected, show empty state
    if (!variable) {
        return (
            <div className={`${styles.inspector} ${className || ''}`}>
                <div className={styles.emptyState}>
                    <Info className={styles.emptyIcon} />
                    <h3 className={styles.emptyTitle}>No Variable Selected</h3>
                    <p className={styles.emptyText}>
                        Select a variable to view its details
                    </p>
                </div>
            </div>
        );
    }

    const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;
    const hasMissingValues =
        (variable.missingValues.discrete && variable.missingValues.discrete.length > 0) ||
        variable.missingValues.range;

    return (
        <div className={`${styles.inspector} ${className || ''}`}>
            {/* Header */}
            <div className={styles.header}>
                <h2 className={styles.variableName}>{variable.name}</h2>
                {variable.label && variable.label !== variable.name && (
                    <p className={styles.variableLabel}>{variable.label}</p>
                )}
            </div>

            {/* Content */}
            <div className={styles.content}>
                {/* Metadata Section */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Metadata</h3>
                    <div className={styles.metaGrid}>
                        <span className={styles.metaLabel}>Type</span>
                        <span className={styles.metaValue}>
                            <span className={`${styles.typeBadge} ${getTypeBadgeClass(variable.type)}`}>
                                {getTypeIcon(variable.type)}
                                {getTypeLabel(variable.type)}
                            </span>
                        </span>

                        <span className={styles.metaLabel}>Variable ID</span>
                        <span className={styles.metaValue}>
                            <code style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-xs)',
                                backgroundColor: 'var(--gray-100)',
                                padding: '2px 6px',
                                borderRadius: '3px',
                            }}>
                                {variable.id}
                            </code>
                        </span>

                        {hasValueLabels && (
                            <>
                                <span className={styles.metaLabel}>Categories</span>
                                <span className={styles.metaValue}>
                                    {variable.valueLabels.length} values
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Value Labels Section */}
                {hasValueLabels && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Value Labels</h3>
                        <div className={styles.valueLabelsScroll}>
                            <table className={styles.valueLabelsTable}>
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Label</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variable.valueLabels.map((vl) => (
                                        <tr key={vl.value}>
                                            <td>
                                                <span className={styles.valueCode}>{vl.value}</span>
                                            </td>
                                            <td className={styles.valueLabel}>{vl.label}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Missing Values Section */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Missing Values</h3>
                    {hasMissingValues ? (
                        <div className={styles.missingValues}>
                            {variable.missingValues.discrete && variable.missingValues.discrete.length > 0 && (
                                <div className={styles.missingValuesList}>
                                    {variable.missingValues.discrete.map((val) => (
                                        <span key={val} className={styles.missingValueChip}>
                                            {val}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {variable.missingValues.range && (
                                <div style={{ marginTop: 'var(--space-2)' }}>
                                    Range: {variable.missingValues.range.low} to {variable.missingValues.range.high}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className={styles.noMissing}>None defined</p>
                    )}
                </div>

                {/* Data Quality Section */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Data Quality</h3>
                    {isLoadingStats ? (
                        <div className={styles.loadingState}>Loading statistics...</div>
                    ) : stats ? (
                        <div className={styles.qualitySection}>
                            {/* Completeness Bar */}
                            <div className={styles.qualityRow}>
                                <span className={styles.qualityLabel}>
                                    <CheckCircle size={14} style={{ color: 'var(--color-success)', marginRight: 6 }} />
                                    Completeness
                                </span>
                                <div className={styles.qualityBarContainer}>
                                    <div
                                        className={styles.qualityBarFill}
                                        style={{
                                            width: `${completenessPercent || 0}%`,
                                            backgroundColor: completenessPercent && completenessPercent >= 80
                                                ? 'var(--color-success)'
                                                : completenessPercent && completenessPercent >= 50
                                                    ? 'var(--color-warning)'
                                                    : 'var(--color-error)',
                                        }}
                                    />
                                </div>
                                <span className={styles.qualityValue}>
                                    {completenessPercent?.toFixed(1)}%
                                </span>
                            </div>

                            {/* Stats Summary */}
                            <div className={styles.statsSummary}>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{stats.totalCount.toLocaleString()}</span>
                                    <span className={styles.statLabel}>Total</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{(stats.totalCount - stats.missingCount).toLocaleString()}</span>
                                    <span className={styles.statLabel}>Valid</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span
                                        className={styles.statValue}
                                        style={{
                                            color: missingPercent && missingPercent > 10
                                                ? 'var(--color-warning)'
                                                : undefined,
                                        }}
                                    >
                                        {stats.missingCount.toLocaleString()}
                                    </span>
                                    <span className={styles.statLabel}>Missing</span>
                                </div>
                            </div>

                            {/* Missing warning */}
                            {missingPercent && missingPercent > 10 && (
                                <div className={styles.warningBanner}>
                                    <AlertTriangle size={14} />
                                    <span>{missingPercent.toFixed(1)}% missing values</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={styles.noStats}>
                            No statistics available
                        </div>
                    )}
                </div>

                {/* Numeric Summary Stats (for scale variables) */}
                {isNumericVariable && numericStats && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Summary Statistics</h3>
                        <div className={styles.numericStatsGrid}>
                            <div className={styles.numericStatItem}>
                                <span className={styles.numericStatLabel}>Min</span>
                                <span className={styles.numericStatValue}>{numericStats.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className={styles.numericStatItem}>
                                <span className={styles.numericStatLabel}>Max</span>
                                <span className={styles.numericStatValue}>{numericStats.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className={styles.numericStatItem}>
                                <span className={styles.numericStatLabel}>Mean</span>
                                <span className={styles.numericStatValue}>{numericStats.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className={styles.numericStatItem}>
                                <span className={styles.numericStatLabel}>Median</span>
                                <span className={styles.numericStatValue}>{numericStats.median.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className={styles.numericStatItem}>
                                <span className={styles.numericStatLabel}>Std Dev</span>
                                <span className={styles.numericStatValue}>{numericStats.stdDev.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className={styles.numericStatItem}>
                                <span className={styles.numericStatLabel}>IQR</span>
                                <span className={styles.numericStatValue}>
                                    {numericStats.q1.toLocaleString(undefined, { maximumFractionDigits: 1 })} – {numericStats.q3.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Distribution Section - Unified using new Renderers */}
                {(nominalChartData || histogramData) && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            Distribution
                            <span style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--gray-400)',
                                fontWeight: 400,
                                marginLeft: 'var(--space-2)',
                            }}>
                                (drag to select, right-click to group)
                            </span>
                        </h3>
                        {/* Rendering logic */}
                        {isNumericVariable && histogramData ? (
                            <HistogramRenderer
                                width={280}
                                height={180}
                                processedData={histogramData}
                                interactive={true}
                                // selectedKeys... we might need to map keys for histogram or leave it internal to renderer if we don't control it
                                onContextMenu={handleContextMenu}
                            // HistogramRenderer doesn't currently support 'selectedKeys', it uses D3Histogram internal state, 
                            // unless we update D3Histogram to be controlled. 
                            // For now, we rely on D3Histogram triggering onContextMenu with selected items.
                            />
                        ) : nominalChartData ? (
                            <HorizontalBarRenderer
                                width={280}
                                height={Math.max(180, nominalChartData.series[0].data.length * 28)}
                                processedData={nominalChartData}
                                interactive={true}
                                selectedKeys={selectedKeys}
                                onSelectionChange={setSelectedKeys}
                                onContextMenu={handleContextMenu}
                                colors={['var(--color-charcoal)', 'var(--color-terracotta)']}
                            />
                        ) : null}
                    </div>
                )}
            </div>

            {/* Shared Chart Context Menu */}
            <ChartContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                title={contextMenu.selected.length === 1 && contextMenu.selected[0].label
                    ? contextMenu.selected[0].label
                    : `${contextMenu.selected.length} items selected`}
                subtitle={contextMenu.selected.length > 1 ? 'Multiple values' : undefined}
                options={[
                    {
                        label: contextMenu.selected.length > 1 ? 'Group these values' : 'Create group from this value',
                        onClick: handleCreateGroup,
                    }
                ]}
                onClose={closeContextMenu}
            />

            {/* Group Name Input Modal */}
            <InputModal
                isOpen={showGroupNameModal}
                onClose={() => {
                    setShowGroupNameModal(false);
                    setPendingGroupSelection([]);
                    setPendingBinSelection([]);
                }}
                onSubmit={handleGroupNameSubmit}
                title="Name this group"
                placeholder="e.g., Low Income, Age 18-34..."
                initialValue=""
                submitLabel={isCreatingRecode ? 'Creating...' : 'Create Group'}
            />
        </div>
    );
};
