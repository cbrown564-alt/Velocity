import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import type { Variable } from '../../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../../types/worker';
import { allowsNumericStats } from '../../../types';
import styles from '../VariableInspector.module.css';

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

    const validCount = stats?.totalCount || 0;
    const missingCount = stats?.missingCount || 0;
    const totalObservations = validCount + missingCount;
    const percentMissing = totalObservations > 0 ? (missingCount / totalObservations) * 100 : 0;
    const isNumericVariable = allowsNumericStats(variable?.type, variable?.orderedScoring);

    return (
        <div className={styles.statsContainer}>

            {/* Dictionary (Value Labels & Missing Values) */}
            {(hasValueLabels || hasMissingValues) && (
                <>
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
                </>
            )}

            {/* Data Quality Footer */}
            <div className={styles.statsSummary}>
                {isLoadingStats ? (
                    <div className="animate-pulse flex space-x-4">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                ) : (
                    <>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Valid</span>
                            <span className={styles.statValue}>{validCount.toLocaleString()}</span>
                        </div>
                        {missingCount > 0 && (
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Missing</span>
                                <span className={`${styles.statValue} ${styles.statValueWarning}`}>
                                    {missingCount.toLocaleString()} ({Math.round(percentMissing)}%)
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
