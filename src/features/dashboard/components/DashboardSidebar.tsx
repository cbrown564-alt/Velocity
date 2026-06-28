import React from 'react';
import { Search, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

import type { Dataset } from '../../../types/dataset';
import type { VariableSet } from '../../../store';
import type { PersistenceManagerState } from '../../../hooks/usePersistenceManager';
import { Logo } from '../../../components/common/Logo';
import { StorageStatusIndicator } from '../../../components/common/StorageStatusIndicator';
import { VirtualizedVariableList } from './VirtualizedVariableList';
import { PersistenceStatus } from './PersistenceStatus';

export interface DashboardSidebarProps {
  focusMode: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredSets: VariableSet[];
  selectedSetIds: Set<string>;
  selectedVariableSetId: string | null;
  hoveredVariableSetId: string | null;
  onRecode: (set: VariableSet) => void;
  onVariableClick: (set: VariableSet, e: React.MouseEvent) => void;
  onContextMenu: (set: VariableSet, e: React.MouseEvent) => void;
  rowIds: Set<string>;
  colId: string | null;
  weightId: string | null;
  filename: string;
  totalRows: number;
  dataset: Dataset | null;
  persistence: PersistenceManagerState;
  opfsAvailable: boolean;
  persistenceMode: string;
  persistenceError: string | null;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  focusMode,
  sidebarCollapsed,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  filteredSets,
  selectedSetIds,
  selectedVariableSetId,
  hoveredVariableSetId,
  onRecode,
  onVariableClick,
  onContextMenu,
  rowIds,
  colId,
  weightId,
  filename,
  totalRows,
  dataset,
  persistence,
  opfsAvailable,
  persistenceMode,
  persistenceError,
}) => {
  const {
    persistentStorageGranted,
    opfsDbLabel,
    opfsUsageMb,
    opfsQuotaMb,
    opfsUsagePct,
    opfsRehydrateError,
    opfsErrorHint,
    datasetVariableCount,
    labeledVariableCount,
    totalValueLabelCount,
    estimatedCells,
    memoryRisk,
    partialLoadMessage,
    refreshOpfsDbFiles,
    purgeQuarantinedDbs,
    rebuildFromOpfsSource,
  } = persistence;

  return (
    <aside
      className={`surface-panel bg-[var(--bg-panel)] border-r border-[var(--border-color)] flex flex-col shrink-0 z-30 relative transition-all duration-300 ${
        focusMode ? 'w-0 opacity-0 overflow-hidden' : sidebarCollapsed ? 'w-14 opacity-100' : 'w-72 opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        className="absolute -right-3 top-4 z-40 w-6 h-6 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--color-accent)] flex items-center justify-center shadow-sm"
        aria-label={sidebarCollapsed ? 'Expand variable sidebar' : 'Collapse variable sidebar'}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {!sidebarCollapsed && (
        <>
          <div className="p-4 border-b border-[var(--border-color-muted)] bg-[var(--bg-panel)]">
            <div className="flex items-center gap-2 mb-4">
              <Logo size={24} />
              <span className="font-semibold text-[var(--text-primary)] tracking-tight">Velocity</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search variables..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg-surface)] border-none rounded-md text-sm focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:bg-[var(--bg-panel)] transition-all outline-none text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-4 pt-3 shrink-0">
              Survey Questions ({filteredSets.length})
            </p>
            <div className="flex-1 min-h-0 px-3">
              <VirtualizedVariableList
                variableSets={filteredSets}
                selectedIds={selectedSetIds}
                focusedId={selectedVariableSetId}
                hoveredId={hoveredVariableSetId}
                onRecode={onRecode}
                onClick={onVariableClick}
                onContextMenu={onContextMenu}
                rowIds={rowIds}
                colId={colId}
                weightId={weightId}
              />
            </div>
          </div>

          <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-panel)]">
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] px-2">
              <CheckCircle2 size={12} className="text-[var(--color-success)]" />
              <span className="truncate">
                {filename} ({totalRows} rows)
              </span>
            </div>
            {dataset?.sampleRowCount && (
              <div className="flex items-center gap-2 text-xs text-[var(--status-warning-text)] px-2 mt-2 bg-[var(--status-warning-surface)] rounded py-1">
                <AlertCircle size={12} />
                <span>Heuristics based on {dataset.sampleRowCount.toLocaleString()} sample rows</span>
              </div>
            )}
            <StorageStatusIndicator
              hasDataset={Boolean(dataset)}
              persistentStorageGranted={persistentStorageGranted}
              opfsAvailable={opfsAvailable}
            />
            <div className="mt-auto">
              <PersistenceStatus
                mode={persistenceMode}
                opfsAvailable={opfsAvailable}
                dbLabel={opfsDbLabel}
                usageMb={opfsUsageMb}
                quotaMb={opfsQuotaMb}
                usagePct={opfsUsagePct}
                error={persistenceError}
                errorHint={opfsErrorHint}
                rehydrateError={opfsRehydrateError}
                datasetRows={dataset?.rowCount ?? null}
                datasetColumns={datasetVariableCount}
                estimatedCells={estimatedCells}
                labeledVariableCount={labeledVariableCount}
                totalVariableCount={datasetVariableCount}
                totalValueLabelCount={totalValueLabelCount}
                memoryRisk={memoryRisk}
                partialLoadMessage={partialLoadMessage}
                opfsFileKey={dataset?.opfsFileKey}
                onRefresh={refreshOpfsDbFiles}
                onPurge={purgeQuarantinedDbs}
                onRebuild={() => void rebuildFromOpfsSource('dashboard')}
              />
            </div>
          </div>
        </>
      )}
    </aside>
  );
};
