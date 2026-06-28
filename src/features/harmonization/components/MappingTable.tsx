/**
 * MappingTable
 *
 * Virtualized list of all VariableMapping entries.
 * Color-coded by status: confirmed=green, auto_matched=amber, unmapped=red.
 */

import React, { useState, useMemo } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { CheckCircle2, AlertCircle, XCircle, HelpCircle, Search } from 'lucide-react';
import type { VariableMapping, MappingStatus } from '../../../types/harmonization';
import type { Variable } from '../../../types/index';
import styles from './MappingTable.module.css';

interface MappingTableProps {
  mappings: VariableMapping[];
  sourceVars: Variable[];
  targetVars: Variable[];
  selectedMappingId: string | null;
  onSelect: (mappingId: string) => void;
  onConfirm: (mappingId: string) => void;
  onUnmap: (mappingId: string) => void;
}

const ROW_HEIGHT = 52;

type RowStatus = 'confirmed' | 'auto_matched' | 'manual' | 'unmapped' | 'excluded';

interface StatusConfig {
  icon: React.ElementType;
  label: string;
  colorClass: string;
}

const STATUS_CONFIG: Record<RowStatus, StatusConfig> = {
  confirmed: { icon: CheckCircle2, label: 'Confirmed', colorClass: styles.confirmed },
  auto_matched: { icon: AlertCircle, label: 'Auto-matched', colorClass: styles.autoMatched },
  manual: { icon: CheckCircle2, label: 'Manual', colorClass: styles.confirmed },
  unmapped: { icon: XCircle, label: 'Unmapped', colorClass: styles.unmapped },
  excluded: { icon: HelpCircle, label: 'Excluded', colorClass: styles.excluded },
};

function getRowStatus(mapping: VariableMapping): RowStatus {
  if (mapping.confirmed) return 'confirmed';
  return mapping.status;
}

type RowProps = {
  filtered: VariableMapping[];
  sourceVarMap: Map<string, Variable>;
  targetVarMap: Map<string, Variable>;
  selectedMappingId: string | null;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  onUnmap: (id: string) => void;
};

function MappingRow({
  index,
  style,
  filtered,
  sourceVarMap,
  targetVarMap,
  selectedMappingId,
  onSelect,
  onConfirm,
  onUnmap,
}: RowComponentProps<RowProps>): React.ReactElement {
  const mapping = filtered[index];
  const sourceVar = sourceVarMap.get(mapping.sourceVariableId);
  const targetVar = mapping.targetVariableId ? targetVarMap.get(mapping.targetVariableId) : null;
  const rowStatus = getRowStatus(mapping);
  const config = STATUS_CONFIG[rowStatus] ?? STATUS_CONFIG.unmapped;
  const Icon = config.icon;
  const isSelected = mapping.id === selectedMappingId;

  return (
    <div
      style={style}
      className={[styles.row, isSelected ? styles.rowSelected : '', config.colorClass].join(' ')}
      onClick={() => onSelect(mapping.id)}
    >
      <div className={styles.rowStatus}>
        <Icon size={14} />
      </div>

      <div className={styles.rowSource}>
        <span className={styles.varName}>{sourceVar?.name ?? '?'}</span>
        <span className={styles.varLabel}>{sourceVar?.label}</span>
      </div>

      <div className={styles.rowArrow}>→</div>

      <div className={styles.rowTarget}>
        {targetVar ? (
          <>
            <span className={styles.varName}>{targetVar.name}</span>
            <span className={styles.varLabel}>{targetVar.label}</span>
          </>
        ) : (
          <span className={styles.unmappedText}>— unmapped —</span>
        )}
      </div>

      {mapping.score && (
        <div className={styles.rowScore}>
          <span className={styles.scoreBadge}>{Math.round(mapping.score.total * 100)}%</span>
        </div>
      )}

      {!mapping.score && <div className={styles.rowScore} />}

      <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
        {!mapping.confirmed && mapping.targetVariableId && (
          <button className={styles.actionBtn} onClick={() => onConfirm(mapping.id)} title="Confirm mapping">
            <CheckCircle2 size={12} />
          </button>
        )}
        {mapping.targetVariableId && (
          <button className={styles.actionBtnDanger} onClick={() => onUnmap(mapping.id)} title="Unmap">
            <XCircle size={12} />
          </button>
        )}
      </div>

      {mapping.warnings.length > 0 && (
        <div className={styles.warningDot} title={`${mapping.warnings.length} warning(s)`} />
      )}
    </div>
  );
}

export const MappingTable: React.FC<MappingTableProps> = ({
  mappings,
  sourceVars,
  targetVars,
  selectedMappingId,
  onSelect,
  onConfirm,
  onUnmap,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MappingStatus | 'all' | 'confirmed'>('all');

  const sourceVarMap = useMemo(() => new Map(sourceVars.map((v) => [v.id, v])), [sourceVars]);
  const targetVarMap = useMemo(() => new Map(targetVars.map((v) => [v.id, v])), [targetVars]);

  const filtered = useMemo(() => {
    return mappings.filter((m) => {
      // Status filter
      if (statusFilter === 'confirmed' && !m.confirmed) return false;
      if (statusFilter !== 'all' && statusFilter !== 'confirmed' && m.status !== statusFilter) return false;

      // Search filter
      if (search) {
        const sourceVar = sourceVarMap.get(m.sourceVariableId);
        const targetVar = m.targetVariableId ? targetVarMap.get(m.targetVariableId) : null;
        const q = search.toLowerCase();
        const inSource = sourceVar?.name.toLowerCase().includes(q) || sourceVar?.label.toLowerCase().includes(q);
        const inTarget = targetVar?.name.toLowerCase().includes(q) || targetVar?.label.toLowerCase().includes(q);
        if (!inSource && !inTarget) return false;
      }
      return true;
    });
  }, [mappings, search, statusFilter, sourceVarMap, targetVarMap]);

  const counts = useMemo(
    () => ({
      confirmed: mappings.filter((m) => m.confirmed).length,
      auto_matched: mappings.filter((m) => m.status === 'auto_matched' && !m.confirmed).length,
      unmapped: mappings.filter((m) => m.status === 'unmapped').length,
      total: mappings.length,
    }),
    [mappings],
  );

  const rowProps: RowProps = useMemo(
    () => ({
      filtered,
      sourceVarMap,
      targetVarMap,
      selectedMappingId,
      onSelect,
      onConfirm,
      onUnmap,
    }),
    [filtered, sourceVarMap, targetVarMap, selectedMappingId, onSelect, onConfirm, onUnmap],
  );

  const listHeight = Math.min(filtered.length * ROW_HEIGHT, 480);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={13} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search variables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All ({counts.total})</option>
          <option value="confirmed">Confirmed ({counts.confirmed})</option>
          <option value="auto_matched">Auto-matched ({counts.auto_matched})</option>
          <option value="unmapped">Unmapped ({counts.unmapped})</option>
        </select>
      </div>

      <div className={styles.tableHeader}>
        <span className={styles.headerStatus}>Status</span>
        <span className={styles.headerSource}>Source</span>
        <span className={styles.headerArrow} />
        <span className={styles.headerTarget}>Target</span>
        <span className={styles.headerScore}>Match</span>
        <span className={styles.headerActions}>Actions</span>
      </div>

      <div className={styles.listWrapper}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>No mappings match filter</div>
        ) : (
          <List
            style={{ height: listHeight, width: '100%' }}
            rowCount={filtered.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={MappingRow}
            rowProps={rowProps}
          />
        )}
      </div>
    </div>
  );
};

export default MappingTable;
