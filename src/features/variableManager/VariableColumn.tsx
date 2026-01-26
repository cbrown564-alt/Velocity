/**
 * VariableColumn Component
 *
 * Column 4 in the Miller Column navigation.
 * Displays individual variables within a selected Variable Set.
 * Only shown for multi-variable sets (grids, multi-response).
 */

import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { Hash, CheckCircle, ChevronRight, Type, Calendar, SlidersHorizontal } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable, Dataset } from '../../store/slices/dataSlice';
import { Sparkline, MissingnessBadge } from './Sparkline';
import { VariableTypeIcon } from '../../components/common/VariableTypeIcon';
import { useLazyObserver } from '../../hooks/useLazyObserver';
import styles from './MillerColumns.module.css';

interface VariableItemProps {
    variable: Variable;
    dataset: Dataset | null;
    isActive: boolean;
    onClick: () => void;
    onHover: () => void;
    frequencies?: number[];
    histogramBins?: any[];
    topCategory?: { label: string; percent: number; count: number };
    missingPercent?: number;
    itemRef?: (el: HTMLDivElement | null) => void;
}



const VariableItem: React.FC<VariableItemProps> = ({
    variable,
    isActive,
    onClick,
    onHover,
    frequencies,
    histogramBins,
    topCategory,
    missingPercent,
    itemRef,
}) => {
    return (
        <div
            ref={itemRef}
            onClick={onClick}
            onMouseEnter={onHover}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
        >
            <div className={styles.itemContent}>
                <VariableTypeIcon type={variable.type} size={14} />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <span className={styles.itemLabel}>{variable.label || variable.name}</span>
                    {variable.label && variable.label !== variable.name && (
                        <div className={styles.itemSubtitle}>
                            {variable.name}
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.itemMeta}>
                {/* Sparkline & Missingness */}
                {(frequencies || histogramBins || topCategory) && (
                    <Sparkline
                        type={variable.type as any}
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
                <ChevronRight className={styles.itemChevron} size={14} />
            </div>
        </div>
    );
};

export const VariableColumn: React.FC = () => {
    const {
        dataset,
        variableSets,
        selectedVariableSetId,
        selectedVariableId,
        setSelectedVariableId,
        getVariableStats,
        variableStats,
    } = useVelocityStore();

    const contentRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Get the selected variable set
    const selectedSet = useMemo(() => {
        if (!selectedVariableSetId) return null;
        return variableSets.find(vs => vs.id === selectedVariableSetId) || null;
    }, [variableSets, selectedVariableSetId]);

    // Get variables for the selected set
    const variables = useMemo(() => {
        if (!selectedSet || !dataset) return [];
        return selectedSet.variableIds
            .map(id => dataset.variables.find(v => v.id === id))
            .filter((v): v is Variable => v !== undefined);
    }, [selectedSet, dataset]);

    // Intersection Observer for auto-loading stats
    useLazyObserver(
        contentRef,
        itemRefs,
        useCallback((id) => {
            if (!variableStats[id]) {
                getVariableStats(id).catch(() => { });
            }
        }, [variableStats, getVariableStats]),
        'data-variable-id',
        [variables, variableStats]
    );

    // Determine if this column should be shown
    // Only show for multi-variable sets (more than 1 variable)
    const shouldShow = selectedSet && selectedSet.variableIds.length > 1;

    if (!shouldShow) {
        return (
            <div className={`${styles.column} ${styles.col4} ${styles.columnHidden}`} />
        );
    }

    const handleSelect = (variableId: string) => {
        setSelectedVariableId(variableId);
    };

    const handleHover = (variableId: string) => {
        if (!variableStats[variableId]) {
            getVariableStats(variableId).catch(() => { });
        }
    };

    // Helper to extract stats for rendering
    const getStats = (variable: Variable) => {
        const stats = variableStats[variable.id];
        if (!stats) return { frequencies: undefined, missingPercent: undefined, histogramBins: undefined, topCategory: undefined };

        const frequencies = stats.frequencies.map(f => f.count);
        const histogramBins = stats.numeric?.histogramBins;

        const missingPercent = stats.totalCount > 0
            ? (stats.missingCount / stats.totalCount) * 100
            : 0;

        let topCategory: { label: string; percent: number; count: number } | undefined;

        if (variable.type === 'nominal' || variable.type === 'text') {
            if (stats.frequencies && stats.frequencies.length > 0) {
                const sorted = [...stats.frequencies].sort((a, b) => b.count - a.count);
                const topItem = sorted[0];
                let label = String(topItem.value);
                if (variable.valueLabels) {
                    const valueLabel = variable.valueLabels.find(vl => vl.value === topItem.value as any);
                    if (valueLabel) label = valueLabel.label;
                }
                const percent = stats.totalCount > 0 ? (topItem.count / stats.totalCount) * 100 : 0;
                topCategory = { label, percent, count: topItem.count };
            }
        }

        return { frequencies, missingPercent, histogramBins, topCategory };
    };

    return (
        <div className={`${styles.column} ${styles.col4}`}>
            <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>Variables</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                    {variables.length}
                </span>
            </div>

            <div className={styles.columnContent} ref={contentRef}>
                {variables.length > 0 ? (
                    variables.map(variable => {
                        const { frequencies, missingPercent, histogramBins, topCategory } = getStats(variable);
                        return (
                            <div key={variable.id} data-variable-id={variable.id}>
                                <VariableItem
                                    variable={variable}
                                    dataset={dataset}
                                    isActive={selectedVariableId === variable.id}
                                    onClick={() => handleSelect(variable.id)}
                                    onHover={() => handleHover(variable.id)}
                                    frequencies={frequencies}
                                    histogramBins={histogramBins}
                                    topCategory={topCategory}
                                    missingPercent={missingPercent}
                                    itemRef={(el) => {
                                        if (el) itemRefs.current.set(variable.id, el);
                                        else itemRefs.current.delete(variable.id);
                                    }}
                                />
                            </div>
                        );
                    })
                ) : (
                    <div className={styles.emptyState}>
                        <CheckCircle className={styles.emptyIcon} />
                        <span className={styles.emptyText}>No variables</span>
                    </div>
                )}
            </div>
        </div>
    );
};
