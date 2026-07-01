/**
 * VariableManager Component
 *
 * The "Data Gardening" spoke in the hub-and-spoke architecture.
 * Full-screen overlay for organizing and managing variables.
 *
 * Features (Milestone 2.2 - Card Sorting):
 * - Miller Column navigation: Sources → Folders → Variable Sets → Variables → Inspector
 * - Multi-select with Shift and Cmd/Ctrl click
 * - Drag-and-drop reordering
 * - Folder organization
 * - Bulk actions (hide, change type, group)
 */

import React, { useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { X, Search, Grid3X3, Tag, BarChart2, SlidersHorizontal, Calendar, Type } from 'lucide-react';
import { useVelocityStore } from '../../store';
import { isCategoricalType, normalizeVariableType } from '../../types';
import { registerShortcut } from '../../lib/keyboardShortcuts/registry';
import { BulkActionBar } from './BulkActionBar';
import { DataSourceColumn } from './DataSourceColumn';
import { FolderColumn } from './FolderColumn';
import { VariableSetColumn } from './VariableSetColumn';
import { VariableColumn } from './VariableColumn';
import { VariableInspector } from './VariableInspector';
import { FacetedSearchBar } from './components/FacetedSearchBar';
import { filterVariableSets } from './variableSetFilters';
import millerStyles from './MillerColumns.module.css';

interface VariableManagerProps {
  onClose: () => void;
}

export const VariableManager: React.FC<VariableManagerProps> = ({ onClose }) => {
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const managerSearchQuery = useVelocityStore((state) => state.managerSearchQuery);
  const setManagerSearchQuery = useVelocityStore((state) => state.setManagerSearchQuery);
  const selectedVariableSetIds = useVelocityStore((state) => state.selectedVariableSetIds);
  const selectedVariableSetId = useVelocityStore((state) => state.selectedVariableSetId);
  const selectedVariableId = useVelocityStore((state) => state.selectedVariableId);
  const activeFolderId = useVelocityStore((state) => state.activeFolderId);
  const selectAllVariableSets = useVelocityStore((state) => state.selectAllVariableSets);
  const clearSelection = useVelocityStore((state) => state.clearSelection);
  const moveToFolder = useVelocityStore((state) => state.moveToFolder);
  const facetFilters = useVelocityStore((state) => state.facetFilters);
  const variableStats = useVelocityStore((state) => state.variableStats);

  // Configure dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const visibleVariableSets = useMemo(() => filterVariableSets(variableSets, { dataset }), [variableSets, dataset]);

  const filteredSets = useMemo(
    () =>
      filterVariableSets(variableSets, {
        dataset,
        activeFolderId,
        searchQuery: managerSearchQuery,
        facetFilters,
        variableStats,
      }),
    [variableSets, dataset, managerSearchQuery, activeFolderId, facetFilters, variableStats],
  );

  const filteredIds = useMemo(() => filteredSets.map((vs) => vs.id), [filteredSets]);

  // Group variables by type for quick stats
  const typeStats = useMemo(() => {
    const stats = { categorical: 0, scale: 0, numeric: 0, date: 0, text: 0 };
    visibleVariableSets.forEach((vs) => {
      const type = normalizeVariableType(vs.type || 'categorical');
      if (isCategoricalType(type)) {
        stats.categorical++;
      } else if (type === 'ordered') {
        stats.scale++;
      } else if (type === 'numeric') {
        stats.numeric++;
      } else if (type === 'date') {
        stats.date++;
      } else if (type === 'text') {
        stats.text++;
      }
    });
    return stats;
  }, [visibleVariableSets]);

  // Handle drag end for folder drops
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Check if dropping on a folder
    if (String(over.id).startsWith('folder-')) {
      const folderId = String(over.id).replace('folder-', '');
      const idsToMove = selectedVariableSetIds.includes(String(active.id))
        ? selectedVariableSetIds
        : [String(active.id)];
      moveToFolder(idsToMove, folderId === 'ungrouped' ? null : folderId);
      clearSelection();
    }
  };

  useEffect(() => {
    const unregisterEscape = registerShortcut({
      id: 'manager-escape',
      contexts: ['manager'],
      priority: 10,
      match: (event) => event.key === 'Escape',
      handler: () => {
        if (selectedVariableSetIds.length > 0) {
          clearSelection();
        } else {
          onClose();
        }
      },
    });

    const unregisterSelectAll = registerShortcut({
      id: 'manager-select-all',
      contexts: ['manager'],
      priority: 20,
      match: (event) => (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a',
      handler: (event) => {
        event.preventDefault();
        selectAllVariableSets(filteredIds);
      },
    });

    return () => {
      unregisterEscape();
      unregisterSelectAll();
    };
  }, [selectedVariableSetIds, clearSelection, selectAllVariableSets, filteredIds, onClose]);

  // Determine if Inspector should be visible
  const showInspector = !!selectedVariableId;

  // Responsive: Track window width to collapse columns on small screens
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compact mode: < 1200px
  const isCompact = windowWidth < 1200;

  // Collapse navigation columns (Sources, Folders) if in compact mode and a variable set is selected
  // This gives space to the actual variable content
  const shouldCollapseNav = isCompact && !!selectedVariableSetId;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="h-full bg-glass-app flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-panel)]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-[var(--color-accent)]" />
              <h1 className="font-display text-lg font-semibold text-[var(--text-primary)] m-0">Variable Manager</h1>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] ml-4">
              <span className="flex items-center gap-1">
                <Tag size={12} className="text-[var(--color-accent)]" />
                {typeStats.categorical} Category
              </span>
              <span className="flex items-center gap-1">
                <SlidersHorizontal size={12} className="text-[var(--text-accent)]" />
                {typeStats.scale} Scale
              </span>
              <span className="flex items-center gap-1">
                <BarChart2 size={12} className="text-[var(--text-accent)]" />
                {typeStats.numeric} Numeric
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-[var(--text-accent)]" />
                {typeStats.date} Date
              </span>
              <span className="flex items-center gap-1">
                <Type size={12} className="text-[var(--text-accent)]" />
                {typeStats.text} Text
              </span>
              <span className="text-[var(--border-color-active)]">|</span>
              <span>{visibleVariableSets.length} total</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search variables..."
                value={managerSearchQuery}
                onChange={(e) => setManagerSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-transparent border-b border-[var(--border-color)] text-sm font-body outline-none focus:border-[var(--color-accent)] focus:border-b-2 transition-all placeholder:text-[var(--text-secondary)] text-[var(--text-primary)]"
              />
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Variable Manager"
              className="flex items-center justify-center w-8 h-8 p-0 border-none rounded-sm bg-transparent text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
        </header>

        {/* Faceted Search Bar */}
        <FacetedSearchBar />

        {/* Miller Columns */}
        <div className={millerStyles.container}>
          {/* Column 1: Data Sources */}
          <DataSourceColumn className={shouldCollapseNav ? millerStyles.columnHidden : ''} />

          {/* Column 2: Folders */}
          <FolderColumn className={shouldCollapseNav ? millerStyles.columnHidden : ''} />

          {/* Column 3: Variable Sets */}
          <VariableSetColumn />

          {/* Column 4: Variables (conditionally shown) */}
          <VariableColumn />

          {/* Column 5: Inspector (conditionally shown) */}
          {showInspector && <VariableInspector />}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-panel)] text-xs text-[var(--text-secondary)] flex items-center justify-between">
          <span>
            {dataset?.name} • {dataset?.rowCount.toLocaleString()} rows
          </span>
          <span className="text-[var(--text-secondary)] opacity-70">
            <kbd className="px-1.5 py-0.5 bg-[var(--bg-active)] rounded text-[10px] font-mono mr-1">⌘A</kbd> Select all
            •<kbd className="px-1.5 py-0.5 bg-[var(--bg-active)] rounded text-[10px] font-mono mx-1">Esc</kbd> Close
          </span>
        </footer>

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedVariableSetIds.length}
          selectedIds={selectedVariableSetIds}
          onClearSelection={clearSelection}
        />
      </div>
    </DndContext>
  );
};
