/**
 * VariableSetColumn Component
 *
 * Column 3 in the Miller Column navigation.
 * Displays variable sets filtered by the active folder.
 * Supports single-click navigation and multi-select for bulk operations.
 * Includes sparklines and missingness indicators.
 */

import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { Hash, Tag, BarChart2, Grid3X3, Layers, ChevronRight, EyeOff, Type, Calendar } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { VariableSet } from '../../store/slices/dataSlice';
import { Sparkline, MissingnessBadge } from './Sparkline';
import styles from './MillerColumns.module.css';

interface VariableSetItemProps {
    variableSet: VariableSet;
    isActive: boolean;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
    onHover: () => void;
    frequencies?: number[];
    missingPercent?: number;
    itemRef?: (el: HTMLDivElement | null) => void;
}

const getTypeIcon = (type?: string) => {
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

const getStructureLabel = (structure: string, count: number) => {
    if (structure === 'single' || count === 1) return null;
    if (structure === 'multiple') return `Multi (${count})`;
    if (structure === 'grid') return `Grid (${count})`;
    return `${count} items`;
};

const VariableSetItem: React.FC<VariableSetItemProps> = ({
    variableSet,
    isActive,
    isSelected,
    onClick,
    onHover,
    frequencies,
    missingPercent,
    itemRef,
}) => {
    const varCount = variableSet.variableIds.length;
    const structureLabel = getStructureLabel(variableSet.structure, varCount);

    return (
        <div
            ref={itemRef}
            data-variable-set-id={variableSet.id}
            onClick={onClick}
            onMouseEnter={onHover}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
            style={{
                backgroundColor: isSelected && !isActive ? 'var(--gray-200)' : undefined,
            }}
        >
            <div className={styles.itemContent}>
                <span className={styles.itemIcon}>
                    {variableSet.structure === 'grid' ? (
                        <Grid3X3 size={14} />
                    ) : variableSet.structure === 'multiple' ? (
                        <Layers size={14} />
                    ) : (
                        getTypeIcon(variableSet.type)
                    )}
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
                </span>
            </div>
            <div className={styles.itemMeta}>
                {/* Show sparkline for single-variable sets */}
                {frequencies && frequencies.length > 0 && (
                    <Sparkline
                        frequencies={frequencies}
                        width={50}
                        height={14}
                        maxBars={5}
                    />
                )}
                {/* Show missingness badge if significant */}
                {missingPercent !== undefined && (
                    <MissingnessBadge
                        missingPercent={missingPercent}
                        threshold={5}
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

export const VariableSetColumn: React.FC = () => {
    const {
        dataset,
        variableSets,
        activeFolderId,
        searchQuery,
        selectedVariableSetId,
        selectedVariableSetIds,
        setSelectedVariableSetId,
        setSelectedVariableId,
        toggleVariableSetSelection,
        selectVariableSetRange,
        getVariableStats,
        variableStats,
        setActiveFolderId,
        facetFilters,
    } = useVelocityStore();

    // Ref for the column content container (for scroll-into-view)
    const contentRef = useRef<HTMLDivElement>(null);
    // Track refs for each item
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Filter variable sets by folder, search, and facets
    const filteredSets = useMemo(() => {
        let sets = variableSets;

        // Filter by folder
        if (activeFolderId === 'ungrouped') {
            sets = sets.filter(vs => !vs.folderId);
        } else if (activeFolderId && activeFolderId !== null) {
            sets = sets.filter(vs => vs.folderId === activeFolderId);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            sets = sets.filter(vs => vs.name.toLowerCase().includes(query));
        }

        // Type facet filter
        if (facetFilters.types.length > 0) {
            sets = sets.filter(vs => {
                // Categorical includes: nominal (unordered), ordinal (ordered), text (open-ended)
                const isCategorical = ['nominal', 'ordinal', 'text'].includes(vs.type || '');
                // Numeric includes: scale (continuous), date (temporal)
                const isNumeric = ['scale', 'date'].includes(vs.type || '');
                return (facetFilters.types.includes('categorical') && isCategorical) ||
                       (facetFilters.types.includes('numeric') && isNumeric);
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
                // For single-variable sets, check the variable's stats
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
                // For multi-variable sets, include by default (no quality filter)
                return true;
            });
        }

        return sets;
    }, [variableSets, activeFolderId, searchQuery, facetFilters, variableStats]);

    const filteredIds = useMemo(() => filteredSets.map(vs => vs.id), [filteredSets]);

    // Bi-directional focus: scroll to selected variable set when it changes
    // This enables context awareness between Analysis Canvas and Variable Manager
    useEffect(() => {
        if (!selectedVariableSetId || !dataset) return;

        // Find the selected variable set
        const targetSet = variableSets.find(vs => vs.id === selectedVariableSetId);
        if (!targetSet) return;

        // Check if we need to switch folders to show the selected variable
        const targetFolderId = targetSet.folderId || 'ungrouped';
        const isInCurrentFolder =
            activeFolderId === null || // "All" folder shows everything
            activeFolderId === targetFolderId ||
            (activeFolderId === 'ungrouped' && !targetSet.folderId);

        if (!isInCurrentFolder) {
            // Switch to the folder containing the selected variable
            // Use null for ungrouped items to show "All" view, or the specific folder
            setActiveFolderId(targetSet.folderId || null);
        }

        // Scroll to the item after a short delay (allow folder switch to render)
        const scrollToItem = () => {
            const itemElement = itemRefs.current.get(selectedVariableSetId);
            if (itemElement) {
                itemElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                });
            }
        };

        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
            requestAnimationFrame(scrollToItem);
        });
    }, [selectedVariableSetId, dataset, variableSets, activeFolderId, setActiveFolderId]);

    // Helper to get stats for a variable set (uses first variable for single sets)
    const getStatsForSet = useCallback((variableSet: VariableSet) => {
        // Only show sparklines for single-variable sets to keep UI clean
        if (variableSet.variableIds.length !== 1) {
            return { frequencies: undefined, missingPercent: undefined };
        }

        const variableId = variableSet.variableIds[0];
        const stats = variableStats[variableId];

        if (!stats) {
            return { frequencies: undefined, missingPercent: undefined };
        }

        const frequencies = stats.frequencies.map(f => f.count);
        const missingPercent = stats.totalCount > 0
            ? (stats.missingCount / stats.totalCount) * 100
            : 0;

        return { frequencies, missingPercent };
    }, [variableStats]);

    // Lazy-load stats on hover
    const handleHover = useCallback((variableSet: VariableSet) => {
        // Only fetch for single-variable sets
        if (variableSet.variableIds.length === 1) {
            const variableId = variableSet.variableIds[0];
            // getVariableStats handles caching internally
            getVariableStats(variableId).catch(err => {
                console.warn('[VariableSetColumn] Failed to fetch stats:', err);
            });
        }
    }, [getVariableStats]);

    const handleClick = (variableSet: VariableSet, e: React.MouseEvent) => {
        // Handle bulk selection with modifier keys
        if (e.shiftKey) {
            selectVariableSetRange(variableSet.id, filteredIds);
            return;
        }

        if (e.metaKey || e.ctrlKey) {
            toggleVariableSetSelection(variableSet.id, true);
            return;
        }

        // Single click - Miller column navigation
        setSelectedVariableSetId(variableSet.id);

        // Smart column skip: if single-variable set, auto-select the variable
        if (variableSet.variableIds.length === 1) {
            setSelectedVariableId(variableSet.variableIds[0]);
        }
    };

    if (!dataset) {
        return (
            <div className={`${styles.column} ${styles.col3}`}>
                <div className={styles.columnHeader}>
                    <span className={styles.columnTitle}>Variable Sets</span>
                </div>
                <div className={styles.emptyState}>
                    <Tag className={styles.emptyIcon} />
                    <span className={styles.emptyText}>No data loaded</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.column} ${styles.col3}`}>
            <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>Variable Sets</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                    {filteredSets.length}
                </span>
            </div>

            <div className={styles.columnContent}>
                {filteredSets.length > 0 ? (
                    filteredSets.map(vs => {
                        const { frequencies, missingPercent } = getStatsForSet(vs);
                        return (
                            <VariableSetItem
                                key={vs.id}
                                variableSet={vs}
                                isActive={selectedVariableSetId === vs.id}
                                isSelected={selectedVariableSetIds.includes(vs.id)}
                                onClick={(e) => handleClick(vs, e)}
                                onHover={() => handleHover(vs)}
                                frequencies={frequencies}
                                missingPercent={missingPercent}
                                itemRef={(el) => {
                                    if (el) {
                                        itemRefs.current.set(vs.id, el);
                                    } else {
                                        itemRefs.current.delete(vs.id);
                                    }
                                }}
                            />
                        );
                    })
                ) : (
                    <div className={styles.emptyState}>
                        <Tag className={styles.emptyIcon} />
                        <span className={styles.emptyText}>
                            {searchQuery ? 'No matching variables' : 'No variables in folder'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
