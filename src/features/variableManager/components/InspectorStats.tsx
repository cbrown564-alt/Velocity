import React, { useMemo, useState, useRef, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Edit2 } from 'lucide-react';
import type { Variable } from '../../../types/dataset';
import type { VariableStatsResult } from '../../../types/worker';
import { useVelocityStore } from '../../../store';
import { ConvertSystemMissingModal } from '../../../components/overlays/ConvertSystemMissingModal';
import styles from '../VariableInspector.module.css';

interface InspectorStatsProps {
  variable: Variable;
  stats: VariableStatsResult | null;
  isLoadingStats: boolean;
  hoveredKey?: string | null;
  onHoverChange?: (key: string | null) => void;
}

export const InspectorStats: React.FC<InspectorStatsProps> = ({
  variable,
  stats,
  hoveredKey,
  onHoverChange,
}) => {
  const { updateValueLabel, toggleDiscreteMissingValue, fillSystemMissing } = useVelocityStore();

  const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;
  const hasMissingValues =
    (variable.missingValues.discrete && variable.missingValues.discrete.length > 0) || variable.missingValues.range;

  // Inline editing state
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [showConvertSystemMissingModal, setShowConvertSystemMissingModal] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((codeStr: string, currentLabel: string) => {
    setEditingCode(codeStr);
    setLabelDraft(currentLabel);
    setTimeout(() => editInputRef.current?.select(), 0);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingCode === null) return;
    const trimmed = labelDraft.trim();
    if (trimmed) {
      updateValueLabel(variable.id, editingCode, trimmed);
    }
    setEditingCode(null);
  }, [editingCode, labelDraft, variable.id, updateValueLabel]);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingCode(null);
  };

  const handleConvertSystemMissing = useCallback(
    async (payload: { code: number; label: string }) => {
      await fillSystemMissing(variable.id, payload.code, payload.label);
    },
    [fillSystemMissing, variable.id],
  );

  const mergedValues = useMemo(() => {
    const map = new Map<string, any>();
    const validBase = Math.max(0, (stats?.totalCount || 0) - (stats?.missingCount || 0));

    // 1. Initialize from value labels (preserves order of labels)
    if (variable.valueLabels) {
      variable.valueLabels.forEach((vl) => {
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
    if (stats?.frequencies) {
      stats.frequencies.forEach((f) => {
        const key = String(f.value);
        const isSystemMissing = f.value === null;
        if (map.has(key)) {
          const item = map.get(key);
          item.count = f.count;
          item.percent = item.isMissing || validBase === 0 ? 0 : (f.count / validBase) * 100;
          item.isMissing = item.isMissing || isSystemMissing;
        } else {
          const isMissing = isSystemMissing || (variable.missingValues.discrete?.includes(f.value as any) ?? false);
          map.set(key, {
            code: f.value,
            label: isSystemMissing ? 'System missing' : String(f.value),
            count: f.count,
            percent: isMissing || validBase === 0 ? 0 : (f.count / validBase) * 100,
            isMissing,
          });
        }
      });
    }

    const values = Array.from(map.values());
    const userMissingCountInRows = values
      .filter((item) => item.isMissing && item.code !== null)
      .reduce((sum, item) => sum + (item.count || 0), 0);
    const systemMissingCount = Math.max(0, (stats?.missingCount || 0) - userMissingCountInRows);
    if (systemMissingCount > 0 && !map.has('null')) {
      values.unshift({
        code: null,
        label: 'System missing',
        count: systemMissingCount,
        percent: 0,
        isMissing: true,
      });
    }

    return values;
  }, [variable.valueLabels, variable.missingValues, stats]);

  return (
    <>
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
                        const isHovered = hoveredKey === codeStr;
                        const isEditing = editingCode === codeStr;
                        return (
                          <tr
                            key={codeStr}
                            onMouseEnter={() => onHoverChange && onHoverChange(codeStr)}
                            onMouseLeave={() => onHoverChange && onHoverChange(null)}
                            className={styles.mappingRow}
                            style={{
                              backgroundColor: isHovered ? 'var(--bg-active)' : 'transparent',
                              transition: 'background-color var(--transition-fast)',
                            }}
                          >
                            <td>
                              <span className={styles.valueCode}>{item.code}</span>
                            </td>
                            <td className={styles.valueLabelContainer}>
                              {isEditing ? (
                                <input
                                  ref={editInputRef}
                                  className={styles.inlineEditInputCell}
                                  value={labelDraft}
                                  onChange={(e) => setLabelDraft(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={handleEditKeyDown}
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span
                                    className={`${styles.valueLabel} ${item.isMissing ? styles.labelMissing : ''}`}
                                    onClick={() => startEdit(codeStr, item.label)}
                                  >
                                    {item.label}
                                  </span>
                                  <Edit2
                                    size={12}
                                    className={styles.mappingEditIcon}
                                    onClick={() => startEdit(codeStr, item.label)}
                                  />
                                  {item.isMissing && <span className={styles.missingBadgeInline}>Missing</span>}
                                </>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }} className={styles.dataCell}>
                              {item.count.toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right' }} className={styles.dataCell}>
                              {item.isMissing ? '-' : item.count > 0 ? `${item.percent.toFixed(1)}%` : '-'}
                            </td>
                            <td className={styles.actionCell}>
                              <button
                                className={styles.tableActionButton}
                                title={
                                  item.code === null
                                    ? 'Convert system missing values'
                                    : item.isMissing
                                      ? `Include ${item.label} (${item.code}) in analysis`
                                      : `Set ${item.label} (${item.code}) as missing`
                                }
                                aria-label={
                                  item.code === null
                                    ? 'Convert system missing values'
                                    : item.isMissing
                                      ? `Include ${item.label} (${item.code}) in analysis`
                                      : `Set ${item.label} (${item.code}) as missing`
                                }
                                onClick={() => {
                                  if (item.code === null) {
                                    setShowConvertSystemMissingModal(true);
                                    return;
                                  }
                                  toggleDiscreteMissingValue(variable.id, item.code, !item.isMissing);
                                }}
                              >
                                {item.code === null ? (
                                  <Edit2 size={14} className={styles.warningIcon} />
                                ) : item.isMissing ? (
                                  <CheckCircle size={14} className={styles.successIcon} />
                                ) : (
                                  <AlertTriangle size={14} className={styles.warningIcon} />
                                )}
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
            {hasMissingValues && !hasValueLabels && (
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
      </div>
      <ConvertSystemMissingModal
        isOpen={showConvertSystemMissingModal}
        onClose={() => setShowConvertSystemMissingModal(false)}
        onSubmit={handleConvertSystemMissing}
      />
    </>
  );
};
