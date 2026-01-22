/**
 * VariableInspector Component
 *
 * Column 5 in the Miller Column navigation.
 * Displays full metadata and distribution for the selected variable.
 * Shows real distribution data from DuckDB queries.
 */

import React, { useMemo, useEffect } from 'react';
import { Tag, Hash, BarChart2, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../services/analysisWorker';
import styles from './VariableInspector.module.css';

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'nominal':
            return <Tag size={14} />;
        case 'ordinal':
            return <BarChart2 size={14} />;
        case 'scale':
            return <Hash size={14} />;
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
        default:
            return type;
    }
};

interface VariableInspectorProps {
    className?: string;
}

export const VariableInspector: React.FC<VariableInspectorProps> = ({ className }) => {
    const {
        dataset,
        selectedVariableId,
        getVariableStats,
        variableStats,
        variableStatsLoading,
    } = useVelocityStore();

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

    // Fetch stats when variable is selected
    useEffect(() => {
        if (selectedVariableId && !stats && !isLoadingStats) {
            getVariableStats(selectedVariableId).catch(err => {
                console.warn('[VariableInspector] Failed to fetch stats:', err);
            });
        }
    }, [selectedVariableId, stats, isLoadingStats, getVariableStats]);

    // Calculate derived stats
    const completenessPercent = stats && stats.totalCount > 0
        ? ((stats.totalCount - stats.missingCount) / stats.totalCount) * 100
        : null;
    const missingPercent = stats && stats.totalCount > 0
        ? (stats.missingCount / stats.totalCount) * 100
        : null;

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

                {/* Distribution Section (real data from DuckDB) */}
                {stats && stats.frequencies.length > 0 && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Distribution</h3>
                        <div className={styles.distributionChart}>
                            {stats.frequencies.map((freq) => {
                                // Get label from valueLabels if available
                                const label = hasValueLabels
                                    ? variable.valueLabels.find(vl => vl.value === freq.value)?.label || String(freq.value)
                                    : String(freq.value);

                                // Calculate percentage of valid responses
                                const validTotal = stats.totalCount - stats.missingCount;
                                const percent = validTotal > 0
                                    ? (freq.count / validTotal) * 100
                                    : 0;

                                return (
                                    <div key={String(freq.value)} className={styles.distributionRow}>
                                        <span className={styles.distributionLabel} title={label}>
                                            {label}
                                        </span>
                                        <div className={styles.distributionBar}>
                                            <div
                                                className={styles.distributionFill}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <span className={styles.distributionPercent}>
                                            {percent.toFixed(1)}%
                                        </span>
                                    </div>
                                );
                            })}
                            {stats.frequencies.length === 10 && (
                                <p style={{
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--gray-400)',
                                    marginTop: 'var(--space-2)',
                                    fontStyle: 'italic',
                                }}>
                                    Showing top 10 values
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
