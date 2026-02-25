import React, { useMemo } from 'react';
import { CheckCircle, AlertTriangle, Edit2 } from 'lucide-react';
import type { Variable } from '../../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../../types/worker';
import { allowsNumericStats } from '../../../types';
import styles from '../VariableInspector.module.css';

interface InspectorStatsProps {
    variable: Variable;
    stats: VariableStatsResult | null;
    isLoadingStats: boolean;
    hoveredKey?: string | null;
    onHoverChange?: (key: string | null) => void;
}

export const InspectorStats: React.FC<InspectorStatsProps> = ({ variable, stats, isLoadingStats, hoveredKey, onHoverChange }) => {
    const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;
    const hasMissingValues =
        (variable.missingValues.discrete && variable.missingValues.discrete.length > 0) ||
        variable.missingValues.range;

    const validCount = stats?.totalCount || 0;
    const missingCount = stats?.missingCount || 0;
    const totalObservations = validCount + missingCount;
    const percentMissing = totalObservations > 0 ? (missingCount / totalObservations) * 100 : 0;
    const isNumericVariable = allowsNumericStats(variable?.type, variable?.orderedScoring);

    const mergedValues = useMemo(() => {
        const map = new Map<string, any>();

        // 1. Initialize from value labels (preserves order of labels)
        if (variable.valueLabels) {
            variable.valueLabels.forEach(vl => {
                map.set(String(vl.value), {
                    code: vl.value,
                    label: vl.label,
                    count: 0,
                    percent: 0,
                    isMissing: variable.missingValues.discrete?.includes(vl.value as any) ?? false,
                });
            });
        }

        // 2. Merge stats frequencies
        const total = stats?.totalCount || 1;
        if (stats?.frequencies) {
            stats.frequencies.forEach(f => {
                const key = String(f.value);
                if (map.has(key)) {
                    const item = map.get(key);
                    item.count = f.count;
                    item.percent = (f.count / total) * 100;
                } else {
                    map.set(key, {
                        code: f.value,
                        label: String(f.value),
                        count: f.count,
                        percent: (f.count / total) * 100,
                        isMissing: variable.missingValues.discrete?.includes(f.value as any) ?? false,
                    });
                }
            });
        }

        return Array.from(map.values());
    }, [variable.valueLabels, variable.missingValues, stats]);

    return (
        <div className={styles.statsContainer}>

            {/* Dictionary (Value Labels & Missing Values) */}
            {(mergedValues.length > 0 || hasMissingValues) && (
                <>
                    {/* Value Labels Section */}
                    {mergedValues.length > 0 && (
                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>Value Mapping</h3>
                            <div className={styles.valueLabelsScroll}>
                                <table className={styles.valueLabelsTable}>
                                    <thead>
                                        <tr>
                                            <th>Code</th>
                                            <th>Label</th>
                                            <th style={{ textAlign: 'right' }}>Count</th>
                                            <th style={{ textAlign: 'right' }}>%</th>
                                            <th style={{ width: 40 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mergedValues.map((item) => {
                                            const codeStr = String(item.code);
                                            const isHovered = hoveredKey === item.label || hoveredKey === codeStr;
                                            return (
                                                <tr
                                                    key={codeStr}
                                                    onMouseEnter={() => onHoverChange && onHoverChange(item.label || codeStr)}
                                                    onMouseLeave={() => onHoverChange && onHoverChange(null)}
                                                    className={styles.mappingRow}
                                                    style={{ backgroundColor: isHovered ? 'var(--bg-active)' : 'transparent', transition: 'background-color var(--transition-fast)' }}
                                                >
                                                    <td>
                                                        <span className={styles.valueCode}>{item.code}</span>
                                                    </td>
                                                    <td className={styles.valueLabelContainer}>
                                                        <span className={`${styles.valueLabel} ${item.isMissing ? styles.labelMissing : ''}`}>
                                                            {item.label}
                                                        </span>
                                                        <Edit2 size={12} className={styles.mappingEditIcon} />
                                                        {item.isMissing && (
                                                            <span className={styles.missingBadgeInline}>Missing</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }} className={styles.dataCell}>
                                                        {item.count.toLocaleString()}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }} className={styles.dataCell}>
                                                        {item.count > 0 ? `${item.percent.toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td className={styles.actionCell}>
                                                        <button
                                                            className={styles.tableActionButton}
                                                            title={item.isMissing ? "Include value" : "Set as Missing"}
                                                        >
                                                            {item.isMissing ? <CheckCircle size={14} className={styles.successIcon} /> : <AlertTriangle size={14} className={styles.warningIcon} />}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Missing Values Section - ONLY show if ranges exist or if table isn't showing missing discreets */}
                    {(hasMissingValues && !hasValueLabels) && (
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
                    )}
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
        </div >
    );
};
