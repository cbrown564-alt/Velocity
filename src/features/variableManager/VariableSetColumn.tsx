/**
 * VariableSetColumn Component
 *
 * Column 3 in the Miller Column navigation.
 * Displays variable sets filtered by the active folder.
 * Supports single-click navigation and multi-select for bulk operations.
 * Includes sparklines and missingness indicators.
 *
 * Uses react-window for virtualization to handle 500+ variable sets smoothly.
 */

import React, { useMemo, useEffect, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, EyeOff, CheckCircle, GitBranch } from 'lucide-react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { useVelocityStore } from '../../store';
import type { VariableSet, Dataset } from '../../store/slices/dataSlice';
import { isCategoricalType, normalizeVariableType } from '../../types';
import { Sparkline, MissingnessBadge } from './Sparkline';
import { VariableTypeIcon } from '../../components/common/VariableTypeIcon';
import { filterSyntheticGridShellSets } from './variableSetFilters';
import styles from './MillerColumns.module.css';

// Height of each row in the virtual list (8px top + ~20px content + 8px bottom + 4px margin)
const ITEM_HEIGHT = 40;
const OVERSCAN_COUNT = 5;

// ============================================================================
// VariableSetItem
// ============================================================================

interface VariableSetItemProps {
    variableSet: VariableSet;
    dataset: Dataset | null; // Needed for value labels
    isActive: boolean;
    isSelected: boolean;
    isHoverLinked?: boolean;
    derivedFromName?: string;
    onClick: (e: React.MouseEvent) => void;
    onHover: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    frequencies?: number[];
    histogramBins?: any[]; // HistogramBin[] from worker
    topCategory?: { label: string; percent: number; count: number }; // For Nominal Leaderboard
    missingPercent?: number;
    valueCount?: number; // Number of distinct values (for label quality dot)
}

const getStructureLabel = (structure: string, count: number) => {
    if (structure === 'single' || count === 1) return null;
    if (structure === 'multiple') return `Multi (${count})`;
    if (structure === 'grid') return `Grid (${count})`;
    return `${count} items`;
};

const getLabelQuality = (
    variableSet: VariableSet,
    dataset: Dataset | null,
    valueCount?: number
): 'none' | 'partial' | 'full' | null => {
    if (!dataset || variableSet.variableIds.length !== 1) return null;
    const variable = dataset.variables.find(v => v.id === variableSet.variableIds[0]);
    if (!variable) return null;
    const labelCount = variable.valueLabels?.length ?? 0;
    if (labelCount === 0) return 'none';
    if (valueCount && valueCount > 0) {
        return labelCount >= valueCount ? 'full' : 'partial';
    }
    // Fallback heuristic when stats not yet loaded
    return labelCount >= 3 ? 'full' : 'partial';
};

const VariableSetItem: React.FC<VariableSetItemProps> = ({
    variableSet,
    dataset,
    isActive,
    isSelected,
    isHoverLinked,
    derivedFromName,
    onClick,
    onHover,
    onContextMenu,
    frequencies,
    histogramBins,
    topCategory,
    missingPercent,
    valueCount,
}) => {
    const varCount = variableSet.variableIds.length;
    const structureLabel = getStructureLabel(variableSet.structure, varCount);
    const labelQuality = getLabelQuality(variableSet, dataset, valueCount);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: variableSet.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
        backgroundColor: isSelected && !isActive ? 'var(--bg-active)' : undefined,
        userSelect: 'none' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            data-variable-set-id={variableSet.id}
            onClick={onClick}
            onMouseEnter={onHover}
            onContextMenu={onContextMenu}
            className={`${styles.item} ${isActive ? styles.itemActive : ''} ${isHoverLinked && !isActive ? styles.itemHoverLinked : ''}`}
        >
            <div className={styles.itemContent}>
                <span className={styles.itemIcon} style={
                    variableSet.structure === 'grid' || variableSet.structure === 'multiple'
                        ? { color: 'var(--text-secondary)' }
                        : undefined
                }>
                    <VariableTypeIcon
                        type={variableSet.type}
                        structure={variableSet.structure as any}
                        size={14}
                    />
                </span>
                <span className={styles.itemLabel}>
                    {variableSet.name}
                    {variableSet.hidden && (
                        <EyeOff
                            size={12}
                            style={{
                                marginLeft: 6,
                                opacity: 0.5,
                                verticalAlign: 'middle',
                            }}
                        />
                    )}
                    {derivedFromName && (
                        <span
                            className={styles.lineageBadge}
                            title={`Derived from ${derivedFromName} via recode`}
                        >
                            <GitBranch size={10} />
                        </span>
                    )}
                </span>
                {labelQuality && (
                    <span
                        className={styles.labelQualityDot}
                        data-quality={labelQuality}
                        title={
                            labelQuality === 'full'
                                ? 'All values labeled'
                                : labelQuality === 'partial'
                                    ? 'Some values unlabeled'
                                    : 'No value labels'
                        }
                    />
                )}
            </div>
            <div className={styles.itemMeta}>
                {(frequencies || histogramBins || topCategory) && (
                    <Sparkline
                        type={variableSet.type as any}
                        frequencies={frequencies}
                        histogramBins={histogramBins}
                        topCategory={topCategory}
                        width={50}
                        height={14}
                        maxBars={5}
                    />
                )}
                {missingPercent !== undefined && (
                    <MissingnessBadge
                        missingPercent={missingPercent}
                        threshold={1}
                    />
                )}
                {structureLabel && (
                    <span className={styles.itemCount}>{structureLabel}</span>
                )}
                <ChevronRight className={styles.itemChevron} size={14} />
            </div>
        </div>
    );
};

// ============================================================================
// VariableSetRow — react-window row renderer (module-level to avoid recreation)
// ============================================================================

type VariableSetRowProps = {
    filteredSets: VariableSet[];
    dataset: Dataset | null;
    selectedVariableSetId: string | null | undefined;
    selectedVariableSetIds: string[];
    hoveredVariableSetId: string | null;
    transformLog: { sourceColId: string; newColId: string; type: string }[];
    getStatsForSet: (vs: VariableSet) => {
        frequencies: number[] | undefined;
        missingPercent: number | undefined;
        histogramBins: any[] | undefined;
        topCategory: { label: string; percent: number; count: number } | undefined;
        valueCount: number | undefined;
    };
    onClickSet: (vs: VariableSet, e: React.MouseEvent) => void;
    onHoverSet: (vs: VariableSet) => void;
    onContextMenuSet: (vs: VariableSet, e: React.MouseEvent) => void;
};

const VariableSetRow = ({
    index,
    style,
    filteredSets,
    dataset,
    selectedVariableSetId,
    selectedVariableSetIds,
    hoveredVariableSetId,
    transformLog,
    getStatsForSet,
    onClickSet,
    onHoverSet,
    onContextMenuSet,
}: RowComponentProps<VariableSetRowProps>): React.ReactElement => {
    const vs = filteredSets[index];
    if (!vs) return <></>;

    const { frequencies, missingPercent, histogramBins, topCategory, valueCount } = getStatsForSet(vs);

    // Recode Chronicle: resolve parent variable name for derived sets
    let derivedFromName: string | undefined;
    if (vs.derived && vs.variableIds.length === 1) {
        const transform = transformLog.find(t => t.newColId === vs.variableIds[0]);
        if (transform) {
            const sourceVar = dataset?.variables.find(v => v.id === transform.sourceColId);
            derivedFromName = sourceVar?.label || sourceVar?.name;
        }
    }

    return (
        <div style={style}>
            <VariableSetItem
                variableSet={vs}
                dataset={dataset}
                isActive={selectedVariableSetId === vs.id}
                isSelected={selectedVariableSetIds.includes(vs.id)}
                isHoverLinked={hoveredVariableSetId === vs.id}
                derivedFromName={derivedFromName}
                onClick={(e) => onClickSet(vs, e)}
                onHover={() => onHoverSet(vs)}
                onContextMenu={(e) => onContextMenuSet(vs, e)}
                frequencies={frequencies}
                histogramBins={histogramBins}
                topCategory={topCategory}
                missingPercent={missingPercent}
                valueCount={valueCount}
            />
        </div>
    );
};

// ============================================================================
// VariableSetColumn
// ============================================================================

export const VariableSetColumn: React.FC = () => {
    const {
        dataset,
        variableSets,
        activeFolderId,
        managerSearchQuery,
        selectedVariableSetId,
        selectedVariableSetIds,
        setSelectedVariableSetId,
        setSelectedVariableId,
        toggleVariableSetSelection,
        selectVariableSetRange,
        selectSingleVariableSet,
        getVariableStats,
        variableStats,
        setActiveFolderId,
        facetFilters,
        convertMultipleToGrid,
        hoveredVariableSetId,
        setHoveredVariableSetId,
        transformLog,
    } = useVelocityStore();

    const listRef = useListRef(null);
    const visibleVariableSets = useMemo(
        () => filterSyntheticGridShellSets(variableSets, dataset),
        [variableSets, dataset]
    );

    // Filter variable sets by folder, search, and facets
    const filteredSets = useMemo(() => {
        let sets = visibleVariableSets;

        // Filter by folder
        if (activeFolderId === 'ungrouped') {
            sets = sets.filter(vs => !vs.folderId);
        } else if (activeFolderId && activeFolderId !== null) {
            sets = sets.filter(vs => vs.folderId === activeFolderId);
        }

        // Filter by search
        if (managerSearchQuery) {
            const query = managerSearchQuery.toLowerCase();
            sets = sets.filter(vs => vs.name.toLowerCase().includes(query));
        }

        // Type facet filter
        if (facetFilters.types.length > 0) {
            sets = sets.filter(vs => {
                return vs.type && facetFilters.types.includes(normalizeVariableType(vs.type));
            });
        }

        // Status facet filter
        if (facetFilters.statuses.length > 0) {
            sets = sets.filter(vs => {
                if (facetFilters.statuses.includes('hidden') && vs.hidden) return true;
                if (facetFilters.statuses.includes('visible') && !vs.hidden) return true;
                if (facetFilters.statuses.includes('derived') && vs.derived) return true;
                return false;
            });
        }

        // Quality facet filter (uses variableStats)
        if (facetFilters.qualities.length > 0) {
            sets = sets.filter(vs => {
                if (vs.variableIds.length === 1) {
                    const stats = variableStats[vs.variableIds[0]];
                    if (!stats) return true; // Include if stats not loaded yet
                    const missingPercent = stats.totalCount > 0
                        ? (stats.missingCount / stats.totalCount) * 100
                        : 0;
                    const isComplete = missingPercent === 0;
                    return (facetFilters.qualities.includes('complete') && isComplete) ||
                        (facetFilters.qualities.includes('incomplete') && !isComplete);
                }
                return true;
            });
        }

        return sets;
    }, [visibleVariableSets, activeFolderId, managerSearchQuery, facetFilters, variableStats]);

    const filteredIds = useMemo(() => filteredSets.map(vs => vs.id), [filteredSets]);

    // Bi-directional focus: scroll to selected variable set when it changes
    useEffect(() => {
        if (!selectedVariableSetId || !dataset) return;

        const targetSet = variableSets.find(vs => vs.id === selectedVariableSetId);
        if (!targetSet) return;

        // Switch folders if necessary
        const targetFolderId = targetSet.folderId || 'ungrouped';
        const isInCurrentFolder =
            activeFolderId === null ||
            activeFolderId === targetFolderId ||
            (activeFolderId === 'ungrouped' && !targetSet.folderId);

        if (!isInCurrentFolder) {
            setActiveFolderId(targetSet.folderId || null);
        }

        // Use the list's imperative API to scroll to the item by index.
        // Double rAF allows a folder switch to flush before we query filteredSets.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const index = filteredSets.findIndex(vs => vs.id === selectedVariableSetId);
                if (index >= 0) {
                    listRef.current?.scrollToRow({ index, align: 'auto', behavior: 'smooth' });
                }
            });
        });
    }, [selectedVariableSetId, dataset, variableSets, activeFolderId, setActiveFolderId, filteredSets, listRef]);

    // Helper to get stats for a variable set (uses first variable for single sets)
    const getStatsForSet = useCallback((variableSet: VariableSet) => {
        if (variableSet.variableIds.length !== 1) {
            return { frequencies: undefined, missingPercent: undefined, histogramBins: undefined, topCategory: undefined, valueCount: undefined };
        }

        const variableId = variableSet.variableIds[0];
        const stats = variableStats[variableId];

        if (!stats) {
            return { frequencies: undefined, missingPercent: undefined, histogramBins: undefined, topCategory: undefined, valueCount: undefined };
        }

        const frequencies = stats.frequencies.map(f => f.count);
        const histogramBins = stats.numeric?.histogramBins;
        const valueCount = stats.frequencies.length;

        const missingPercent = stats.totalCount > 0
            ? (stats.missingCount / stats.totalCount) * 100
            : 0;

        let topCategory: { label: string; percent: number; count: number } | undefined;

        if (isCategoricalType(variableSet.type) || variableSet.type === 'text') {
            if (stats.frequencies && stats.frequencies.length > 0) {
                const sorted = [...stats.frequencies].sort((a, b) => b.count - a.count);
                const topItem = sorted[0];

                let label = String(topItem.value);
                if (dataset) {
                    const variable = dataset.variables.find(v => v.id === variableId);
                    if (variable?.valueLabels) {
                        const valueLabel = variable.valueLabels.find(vl => vl.value === topItem.value as any);
                        if (valueLabel) {
                            label = valueLabel.label;
                        }
                    }
                }

                const percent = stats.totalCount > 0 ? (topItem.count / stats.totalCount) * 100 : 0;
                topCategory = { label, percent, count: topItem.count };
            }
        }

        return { frequencies, missingPercent, histogramBins, topCategory, valueCount };
    }, [variableStats, dataset]);

    // Load stats on hover + cross-surface hover state (Living Inspector)
    const handleHover = useCallback((variableSet: VariableSet) => {
        setHoveredVariableSetId(variableSet.id);
        if (variableSet.variableIds.length === 1) {
            const variableId = variableSet.variableIds[0];
            getVariableStats(variableId).catch(err => {
                console.warn('[VariableSetColumn] Failed to fetch stats:', err);
            });
        }
    }, [getVariableStats, setHoveredVariableSetId]);

    // Load stats for all rows as they scroll into view
    const handleRowsRendered = useCallback(
        ({ startIndex, stopIndex }: { startIndex: number; stopIndex: number }) => {
            for (let i = startIndex; i <= stopIndex; i++) {
                const vs = filteredSets[i];
                if (vs && vs.variableIds.length === 1) {
                    const variableId = vs.variableIds[0];
                    if (!variableStats[variableId]) {
                        getVariableStats(variableId).catch(() => { });
                    }
                }
            }
        },
        [filteredSets, variableStats, getVariableStats]
    );

    const handleClick = useCallback((variableSet: VariableSet, e: React.MouseEvent) => {
        if (e.shiftKey) {
            selectVariableSetRange(variableSet.id, filteredIds);
            return;
        }

        if (e.metaKey || e.ctrlKey) {
            toggleVariableSetSelection(variableSet.id, true);
            return;
        }

        setSelectedVariableSetId(variableSet.id);
        selectSingleVariableSet(variableSet.id);

        if (variableSet.variableIds.length === 1) {
            setSelectedVariableId(variableSet.variableIds[0]);
        }
    }, [selectVariableSetRange, filteredIds, toggleVariableSetSelection, setSelectedVariableSetId, selectSingleVariableSet, setSelectedVariableId]);

    const handleContextMenu = useCallback((variableSet: VariableSet, e: React.MouseEvent) => {
        e.preventDefault();

        if (variableSet.structure === 'multiple') {
            const confirmed = window.confirm(
                `Convert "${variableSet.name}" to a grid to show all response values?\n\n` +
                `This will change from showing only "${variableSet.countedValue ? 'selected' : 'positive'}" responses to showing all response options.`
            );
            if (confirmed) {
                convertMultipleToGrid(variableSet.id);
            }
        }
    }, [convertMultipleToGrid]);

    const rowProps = useMemo<VariableSetRowProps>(() => ({
        filteredSets,
        dataset,
        selectedVariableSetId: selectedVariableSetId ?? null,
        selectedVariableSetIds,
        hoveredVariableSetId,
        transformLog,
        getStatsForSet,
        onClickSet: handleClick,
        onHoverSet: handleHover,
        onContextMenuSet: handleContextMenu,
    }), [filteredSets, dataset, selectedVariableSetId, selectedVariableSetIds, hoveredVariableSetId, transformLog, getStatsForSet, handleClick, handleHover, handleContextMenu]);

    if (!dataset) {
        return (
            <div className={`${styles.column} ${styles.col3}`}>
                <div className={styles.columnHeader}>
                    <span className={styles.columnTitle}>Variable Sets</span>
                </div>
                <div className={styles.emptyState}>
                    <CheckCircle className={styles.emptyIcon} />
                    <span className={styles.emptyText}>No data loaded</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.column} ${styles.col3}`} onMouseLeave={() => setHoveredVariableSetId(null)}>
            <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>Variable Sets</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {filteredSets.length}
                </span>
            </div>

            {filteredSets.length === 0 ? (
                <div className={styles.emptyState}>
                    <CheckCircle className={styles.emptyIcon} />
                    <span className={styles.emptyText}>
                        {managerSearchQuery ? 'No matching variables' : 'No variables in folder'}
                    </span>
                </div>
            ) : (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <List
                        listRef={listRef}
                        rowCount={filteredSets.length}
                        rowHeight={ITEM_HEIGHT}
                        overscanCount={OVERSCAN_COUNT}
                        onRowsRendered={handleRowsRendered}
                        rowComponent={VariableSetRow}
                        rowProps={rowProps}
                        style={{ padding: 'var(--space-2)' }}
                    />
                </div>
            )}
        </div>
    );
};
