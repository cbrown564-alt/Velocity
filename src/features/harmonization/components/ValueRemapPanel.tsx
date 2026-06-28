/**
 * ValueRemapPanel
 *
 * Value-level mapping editor for a selected variable pair.
 * Shows source values → target value selectors with warning icons.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Shuffle } from 'lucide-react';
import type { VariableMapping, ValueMapping } from '../../../types/harmonization';
import type { Variable } from '../../../types/index';
import { generateValueMappings } from '../../../core/harmonization/matchEngine';
import styles from './ValueRemapPanel.module.css';

interface ValueRemapPanelProps {
  mapping: VariableMapping;
  sourceVar: Variable;
  targetVar: Variable;
  onUpdateValueMappings: (mappingId: string, valueMappings: ValueMapping[]) => void;
}

export const ValueRemapPanel: React.FC<ValueRemapPanelProps> = ({
  mapping,
  sourceVar,
  targetVar,
  onUpdateValueMappings,
}) => {
  const hasScaleInversion = mapping.warnings.some((w) => w.kind === 'scale_inversion');

  const targetOptions = useMemo(
    () => [
      { value: null, label: '— unmapped —' },
      ...targetVar.valueLabels.map((v) => ({
        value: v.value,
        label: `${v.value}: ${v.label}`,
      })),
    ],
    [targetVar.valueLabels],
  );

  const handleTargetChange = (sourceValue: number | null, rawTargetValue: string) => {
    const targetValue = rawTargetValue === '' ? null : Number(rawTargetValue);
    const targetLabel = targetVar.valueLabels.find((v) => v.value === targetValue)?.label ?? '';

    const updated = mapping.valueMappings.map((vm) =>
      vm.sourceValue === sourceValue ? { ...vm, targetValue, targetLabel } : vm,
    );

    onUpdateValueMappings(mapping.id, updated);
  };

  const handleAutoAlign = () => {
    const auto = generateValueMappings(sourceVar, targetVar);
    onUpdateValueMappings(mapping.id, auto);
  };

  if (sourceVar.valueLabels.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noLabels}>No value labels defined — direct value passthrough</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.varPair}>
            <code>{sourceVar.name}</code>
            <span className={styles.arrow}>→</span>
            <code>{targetVar.name}</code>
          </span>
          {hasScaleInversion && (
            <div className={styles.inversionAlert}>
              <AlertTriangle size={12} />
              Scale inversion detected — values are reversed
            </div>
          )}
        </div>
        <button className={styles.autoAlignBtn} onClick={handleAutoAlign} title="Auto-align by label similarity">
          <Shuffle size={12} />
          Auto-align
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableHead}>
          <span>Source value</span>
          <span>Source label</span>
          <span className={styles.arrowCol} />
          <span>Target mapping</span>
          <span className={styles.warnCol} />
        </div>

        <div className={styles.rows}>
          {mapping.valueMappings.map((vm, i) => {
            const isOrphan = vm.targetValue === null;

            return (
              <div key={i} className={[styles.valueRow, isOrphan ? styles.orphanRow : ''].join(' ')}>
                <span className={styles.sourceValue}>{vm.sourceValue ?? '—'}</span>
                <span className={styles.sourceLabel}>{vm.sourceLabel}</span>
                <span className={styles.arrowCell}>→</span>
                <select
                  className={styles.targetSelect}
                  value={vm.targetValue ?? ''}
                  onChange={(e) => handleTargetChange(vm.sourceValue, e.target.value)}
                >
                  {targetOptions.map((opt) => (
                    <option key={opt.value ?? 'null'} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className={styles.warnCell}>
                  {isOrphan && <AlertTriangle size={11} className={styles.warnIcon} />}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ValueRemapPanel;
