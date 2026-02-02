import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { VariableTypeIcon } from '../../../components/common/VariableTypeIcon';
import type { Variable } from '../../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../../types/worker';
import styles from '../VariableInspector.module.css';

const getTypeBadgeClass = (type: string) => {
    switch (type) {
        case 'nominal':
            return styles.typeBadgeNominal;
        case 'ordinal':
            return styles.typeBadgeOrdinal;
        case 'scale':
        case 'numeric':
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
            return 'Scale';
        case 'numeric':
            return 'Numeric';
        case 'text':
            return 'Text';
        case 'date':
            return 'Date';
        default:
            return type;
    }
};

interface InspectorStatsProps {
    variable: Variable;
    stats: VariableStatsResult | null;
    isLoadingStats: boolean;
}

export const InspectorStats: React.FC<InspectorStatsProps> = ({ variable, stats, isLoadingStats }) => {
    const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;
    const hasMissingValues =
        (variable.missingValues.discrete && variable.missingValues.discrete.length > 0) ||
        variable.missingValues.range;

    // Derived stats
    const completenessPercent = stats && stats.totalCount > 0
        ? ((stats.totalCount - stats.missingCount) / stats.totalCount) * 100
        : null;
    const missingPercent = stats && stats.totalCount > 0
        ? (stats.missingCount / stats.totalCount) * 100
        : null;

    const isNumericVariable = variable?.type === 'numeric' || variable?.type === 'scale';
    const numericStats = stats?.numeric;

    return (
        <>
            {/* Metadata Section */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Metadata</h3>
                <div className={styles.metaGrid}>
                    <span className={styles.metaLabel}>Type</span>
                    <span className={styles.metaValue}>
                        <span className={`${styles.typeBadge} ${getTypeBadgeClass(variable.type)}`}>
                            <VariableTypeIcon type={variable.type} size={14} />
                            {getTypeLabel(variable.type)}
                        </span>
                    </span>

                    <span className={styles.metaLabel}>Variable ID</span>
                    <span className={styles.metaValue}>
                        <code className={styles.variableIdCode}>
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
                                    <tr key={vl.value} className="mission-control-row">
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
                            {(() => {
                                const completenessColor = completenessPercent && completenessPercent >= 80
                                    ? 'var(--status-success-text)'
                                    : completenessPercent && completenessPercent >= 50
                                        ? 'var(--status-warning-text)'
                                        : 'var(--status-error-text)';

                                return (
                                    <>
                                        <span className={styles.qualityLabel}>
                                            <CheckCircle size={14} style={{ color: completenessColor, marginRight: 6 }} />
                                            Completeness
                                        </span>
                                        <div className={styles.qualityBarContainer}>
                                            <div
                                                className={styles.qualityBarFill}
                                                style={{
                                                    width: `${completenessPercent || 0}%`,
                                                    backgroundColor: completenessColor,
                                                }}
                                            />
                                        </div>
                                        <span className={styles.qualityValue}>
                                            {completenessPercent?.toFixed(1)}%
                                        </span>
                                    </>
                                );
                            })()}
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
                        {(missingPercent ?? 0) > 10 && (
                            <div className={styles.warningBanner}>
                                <AlertTriangle size={14} />
                                <span>{missingPercent?.toFixed(1)}% missing values</span>
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
        </>
    );
};
