/**
 * VariableManager Component
 *
 * Two-pane layout: dense variable list + inspector (WP2.5 design reset).
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { X } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { TypeFacet } from '../../store/slices/uiSlice';
import { normalizeVariableType } from '../../types';
import { registerShortcut } from '../../lib/keyboardShortcuts/registry';
import { BulkActionBar } from './BulkActionBar';
import { VariableList } from './VariableList';
import { VariableInspector } from './VariableInspector';
import { filterVariableSets } from './variableSetFilters';
import styles from './VariableManager.module.css';

interface VariableManagerProps {
  onClose: () => void;
}

type TypeChip = {
  id: 'all' | TypeFacet;
  label: string;
  count: number;
};

const TYPE_CHIP_ORDER: { id: TypeFacet; label: string }[] = [
  { id: 'categorical', label: 'Category' },
  { id: 'ordered', label: 'Scale' },
  { id: 'numeric', label: 'Numeric' },
  { id: 'date', label: 'Date' },
  { id: 'text', label: 'Text' },
];

export const VariableManager: React.FC<VariableManagerProps> = ({ onClose }) => {
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const folders = useVelocityStore((state) => state.folders);
  const managerSearchQuery = useVelocityStore((state) => state.managerSearchQuery);
  const setManagerSearchQuery = useVelocityStore((state) => state.setManagerSearchQuery);
  const selectedVariableSetIds = useVelocityStore((state) => state.selectedVariableSetIds);
  const activeFolderId = useVelocityStore((state) => state.activeFolderId);
  const setActiveFolderId = useVelocityStore((state) => state.setActiveFolderId);
  const selectAllVariableSets = useVelocityStore((state) => state.selectAllVariableSets);
  const clearSelection = useVelocityStore((state) => state.clearSelection);
  const moveToFolder = useVelocityStore((state) => state.moveToFolder);
  const facetFilters = useVelocityStore((state) => state.facetFilters);
  const setFacetFilters = useVelocityStore((state) => state.setFacetFilters);
  const variableStats = useVelocityStore((state) => state.variableStats);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const visibleVariableSets = useMemo(() => filterVariableSets(variableSets, { dataset }), [variableSets, dataset]);

  const folderScopedSets = useMemo(
    () =>
      filterVariableSets(variableSets, {
        dataset,
        activeFolderId,
        searchQuery: managerSearchQuery,
        variableStats,
      }),
    [variableSets, dataset, activeFolderId, managerSearchQuery, variableStats],
  );

  const filteredSets = useMemo(
    () =>
      filterVariableSets(variableSets, {
        dataset,
        activeFolderId,
        searchQuery: managerSearchQuery,
        facetFilters,
        variableStats,
      }),
    [variableSets, dataset, activeFolderId, managerSearchQuery, facetFilters, variableStats],
  );

  const filteredIds = useMemo(() => filteredSets.map((vs) => vs.id), [filteredSets]);

  const typeChips = useMemo((): TypeChip[] => {
    const counts = { categorical: 0, ordered: 0, numeric: 0, date: 0, text: 0 };
    folderScopedSets.forEach((vs) => {
      const type = normalizeVariableType(vs.type || 'categorical');
      if (type === 'categorical') counts.categorical++;
      else if (type === 'ordered') counts.ordered++;
      else if (type === 'numeric') counts.numeric++;
      else if (type === 'date') counts.date++;
      else if (type === 'text') counts.text++;
    });
    const chips: TypeChip[] = [{ id: 'all', label: 'All', count: folderScopedSets.length }];
    TYPE_CHIP_ORDER.forEach(({ id, label }) => {
      if (counts[id] > 0) chips.push({ id, label, count: counts[id] });
    });
    return chips;
  }, [folderScopedSets]);

  const folderChips = useMemo(() => {
    const counts: Record<string, number> = { ungrouped: 0 };
    folders.forEach((f) => {
      counts[f.id] = 0;
    });
    visibleVariableSets.forEach((vs) => {
      if (vs.folderId && counts[vs.folderId] !== undefined) counts[vs.folderId]++;
      else counts.ungrouped++;
    });
    return {
      all: visibleVariableSets.length,
      ungrouped: counts.ungrouped,
      folders: folders.map((f) => ({ id: f.id, name: f.name, count: counts[f.id] || 0 })),
    };
  }, [folders, visibleVariableSets]);

  const activeTypeChip = facetFilters.types.length === 1 ? facetFilters.types[0] : 'all';

  const handleTypeChip = useCallback(
    (chipId: TypeChip['id']) => {
      if (chipId === 'all') {
        setFacetFilters({ types: [] });
        return;
      }
      const isActive = facetFilters.types.length === 1 && facetFilters.types[0] === chipId;
      setFacetFilters({ types: isActive ? [] : [chipId] });
    },
    [facetFilters.types, setFacetFilters],
  );

  const handleFolderChip = useCallback((folderId: string | null) => setActiveFolderId(folderId), [setActiveFolderId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
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
        if (selectedVariableSetIds.length > 0) clearSelection();
        else onClose();
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={styles.shell} data-testid="variable-manager">
        <header className={styles.header}>
          <div className="flex items-center gap-3 min-w-0">
            <h1 className={styles.headerTitle}>Variables</h1>
            {dataset && (
              <span className={styles.headerMeta}>
                {dataset.name} · {visibleVariableSets.length} variables · {dataset.rowCount.toLocaleString()} rows
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close Variable Manager" className={styles.closeButton}>
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.listPane}>
            <div className={styles.tools}>
              <div className={styles.search}>
                <span className={styles.searchIcon} aria-hidden>
                  ⌕
                </span>
                <input
                  type="search"
                  placeholder="Filter variables…"
                  aria-label="Filter variables"
                  value={managerSearchQuery}
                  onChange={(e) => setManagerSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.chips} role="group" aria-label="Type filters">
                {typeChips.map((chip) => {
                  const isActive = chip.id === 'all' ? activeTypeChip === 'all' : activeTypeChip === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
                      onClick={() => handleTypeChip(chip.id)}
                      aria-pressed={isActive}
                    >
                      {chip.label} {chip.count}
                    </button>
                  );
                })}
              </div>
              {(folders.length > 0 || folderChips.ungrouped < folderChips.all) && (
                <>
                  <span className={styles.chipDivider} aria-hidden />
                  <div className={styles.chips} role="group" aria-label="Folder filters">
                    <button
                      type="button"
                      className={`${styles.chip} ${activeFolderId === null ? styles.chipActive : ''}`}
                      onClick={() => handleFolderChip(null)}
                      aria-pressed={activeFolderId === null}
                    >
                      All folders {folderChips.all}
                    </button>
                    <button
                      type="button"
                      className={`${styles.chip} ${activeFolderId === 'ungrouped' ? styles.chipActive : ''}`}
                      onClick={() => handleFolderChip('ungrouped')}
                      aria-pressed={activeFolderId === 'ungrouped'}
                    >
                      Ungrouped {folderChips.ungrouped}
                    </button>
                    {folderChips.folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className={`${styles.chip} ${activeFolderId === folder.id ? styles.chipActive : ''}`}
                        onClick={() => handleFolderChip(folder.id)}
                        aria-pressed={activeFolderId === folder.id}
                      >
                        {folder.name} {folder.count}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className={styles.rows}>
              <VariableList />
            </div>
          </div>
          <aside className={styles.inspectorPane}>
            <VariableInspector />
          </aside>
        </div>

        <footer className={styles.footer}>
          <span>
            {filteredSets.length} shown
            {managerSearchQuery || facetFilters.types.length > 0 || activeFolderId
              ? ` of ${visibleVariableSets.length}`
              : ''}
          </span>
          <span>
            <kbd>⌘A</kbd> Select all · <kbd>Esc</kbd> Close
          </span>
        </footer>

        <BulkActionBar
          selectedCount={selectedVariableSetIds.length}
          selectedIds={selectedVariableSetIds}
          onClearSelection={clearSelection}
        />
      </div>
    </DndContext>
  );
};
