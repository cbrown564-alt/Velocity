/**
 * VariableInspector Component
 *
 * Column 5 in the Miller Column navigation.
 * Displays full metadata and distribution for the selected variable.
 */

import React, { useMemo } from 'react';
import { Tag, Hash, BarChart2, Info } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../store/slices/dataSlice';
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
    } = useVelocityStore();

    // Get the selected variable
    const variable = useMemo((): Variable | null => {
        if (!selectedVariableId || !dataset) return null;
        return dataset.variables.find(v => v.id === selectedVariableId) || null;
    }, [selectedVariableId, dataset]);

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

                {/* Distribution Section (static from value labels) */}
                {hasValueLabels && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Distribution</h3>
                        <div className={styles.distributionChart}>
                            {variable.valueLabels.slice(0, 10).map((vl, index) => {
                                // Static distribution - evenly distributed for display
                                // Real distribution would require DuckDB query
                                const mockPercent = Math.max(5, 100 / variable.valueLabels.length - index * 2);
                                return (
                                    <div key={vl.value} className={styles.distributionRow}>
                                        <span className={styles.distributionLabel} title={vl.label}>
                                            {vl.label}
                                        </span>
                                        <div className={styles.distributionBar}>
                                            <div
                                                className={styles.distributionFill}
                                                style={{ width: `${mockPercent}%` }}
                                            />
                                        </div>
                                        <span className={styles.distributionPercent}>
                                            --
                                        </span>
                                    </div>
                                );
                            })}
                            {variable.valueLabels.length > 10 && (
                                <p style={{
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--gray-400)',
                                    marginTop: 'var(--space-2)',
                                    fontStyle: 'italic',
                                }}>
                                    + {variable.valueLabels.length - 10} more values
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
