/**
 * RecentVariableStrip — thin collapsible row of pinned + MRU variables (DESIGN-CONV-C).
 */

import React, { useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { useVelocityStore } from '../../../store';
import { buildStripVariableIds } from '../../../lib/recentVariableStrip';
import type { VariableSet } from '../../../types';
import { StripVariableChip } from './StripVariableChip';

export interface RecentVariableStripProps {
  onVariableClick?: (variableSet: VariableSet, e: React.MouseEvent) => void;
}

export const RecentVariableStrip: React.FC<RecentVariableStripProps> = ({ onVariableClick }) => {
  const focusMode = useVelocityStore((state) => state.focusMode);
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const pinnedIds = useVelocityStore((state) => state.pinnedVariableSetIds ?? []);
  const recentIds = useVelocityStore((state) => state.recentVariableSetIds ?? []);
  const collapsed = useVelocityStore((state) => state.recentStripCollapsed ?? false);
  const toggleCollapsed = useVelocityStore((state) => state.toggleRecentStripCollapsed);
  const togglePinned = useVelocityStore((state) => state.togglePinnedVariableSet);

  const stripIds = useMemo(() => buildStripVariableIds(pinnedIds, recentIds), [pinnedIds, recentIds]);

  const stripSets = useMemo(() => {
    const byId = new Map(variableSets.map((set) => [set.id, set]));
    return stripIds.map((id) => byId.get(id)).filter((set): set is VariableSet => !!set);
  }, [stripIds, variableSets]);

  const rowIds = useMemo(() => new Set(tableConfig.rowVars), [tableConfig.rowVars]);

  if (focusMode || stripSets.length === 0) {
    return null;
  }

  const handleContextMenu = (set: VariableSet) => {
    togglePinned(set.id);
  };

  return (
    <div
      className="shrink-0 h-8 border-b border-[var(--border-color-muted)] bg-[var(--bg-app)] flex items-center gap-2 px-4"
      data-testid="recent-variable-strip"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        className="inline-flex items-center gap-1 shrink-0 h-6 px-1.5 rounded-md text-[10.5px] uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-rail)] transition-colors"
        aria-expanded={!collapsed}
        aria-controls="recent-variable-strip-items"
        data-testid="recent-variable-strip-toggle"
      >
        Recent
        {collapsed ? <ChevronDown size={12} aria-hidden /> : <ChevronUp size={12} aria-hidden />}
      </button>

      {!collapsed && (
        <div
          id="recent-variable-strip-items"
          className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none"
          data-testid="recent-variable-strip-items"
        >
          {stripSets.map((set) => {
            const shelfType =
              dataset?.weightVariable === set.variableIds[0]
                ? 'weight'
                : tableConfig.colVar === set.id
                  ? 'col'
                  : rowIds.has(set.id)
                    ? 'row'
                    : null;

            return (
              <StripVariableChip
                key={set.id}
                variableSet={set}
                pinned={pinnedIds.includes(set.id)}
                shelfType={shelfType}
                onClick={onVariableClick}
                onContextMenu={handleContextMenu}
              />
            );
          })}
        </div>
      )}

      {collapsed && (
        <span className="text-[11px] text-[var(--text-tertiary)] truncate" data-testid="recent-variable-strip-summary">
          {stripSets.length} variable{stripSets.length === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
};
