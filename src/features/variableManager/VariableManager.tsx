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

import React, { useEffect, useCallback, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import { X, Search, Grid3X3, Tag, BarChart2 } from 'lucide-react';
import { useVelocityStore } from '../../store';
import { BulkActionBar } from './BulkActionBar';
import { DataSourceColumn } from './DataSourceColumn';
import { FolderColumn } from './FolderColumn';
import { VariableSetColumn } from './VariableSetColumn';
import { VariableColumn } from './VariableColumn';
import { VariableInspector } from './VariableInspector';
import { FacetedSearchBar } from './components/FacetedSearchBar';
import millerStyles from './MillerColumns.module.css';

interface VariableManagerProps {
    onClose: () => void;
}

export const VariableManager: React.FC<VariableManagerProps> = ({ onClose }) => {
    const {
        dataset,
        variableSets,
        searchQuery,
        setSearchQuery,
        selectedVariableSetIds,
        selectedVariableId,
        activeFolderId,
        selectAllVariableSets,
        clearSelection,
        moveToFolder,
        facetFilters,
        variableStats,
    } = useVelocityStore();

    // Configure dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor)
    );

    // Filter variable sets by search, folder, and facets for keyboard shortcuts
    const filteredSets = useMemo(() => {
        let sets = variableSets;

        // Filter by folder
        if (activeFolderId === 'ungrouped') {
            sets = sets.filter(vs => !vs.folderId);
        } else if (activeFolderId && activeFolderId !== null) {
            sets = sets.filter(vs => vs.folderId === activeFolderId);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            sets = sets.filter(vs => vs.name.toLowerCase().includes(query));
        }

        // Type facet filter
        if (facetFilters.types.length > 0) {
            sets = sets.filter(vs => {
                // Categorical includes: nominal (unordered), ordinal (ordered), text (open-ended)
                const isCategorical = ['nominal', 'ordinal', 'text'].includes(vs.type || '');
                // Numeric includes: scale (continuous), date (temporal)
                const isNumeric = ['scale', 'date'].includes(vs.type || '');
                return (facetFilters.types.includes('categorical') && isCategorical) ||
                       (facetFilters.types.includes('numeric') && isNumeric);
            });
        }

        // Status facet filter
        if (facetFilters.statuses.length > 0) {
            sets = sets.filter(vs => {
                if (facetFilters.statuses.includes('hidden') && vs.hidden) return true;
                if (facetFilters.statuses.includes('visible') && !vs.hidden) return true;
                if (facetFilters.statuses.includes('derived') && vs.derived) return true;
                return false;
            });
        }

        // Quality facet filter
        if (facetFilters.qualities.length > 0) {
            sets = sets.filter(vs => {
                if (vs.variableIds.length === 1) {
                    const stats = variableStats[vs.variableIds[0]];
                    if (!stats) return true;
                    const missingPercent = stats.totalCount > 0
                        ? (stats.missingCount / stats.totalCount) * 100
                        : 0;
                    const isComplete = missingPercent === 0;
                    return (facetFilters.qualities.includes('complete') && isComplete) ||
                           (facetFilters.qualities.includes('incomplete') && !isComplete);
                }
                return true;
            });
        }

        return sets;
    }, [variableSets, searchQuery, activeFolderId, facetFilters, variableStats]);

    const filteredIds = useMemo(() => filteredSets.map(vs => vs.id), [filteredSets]);

    // Group variables by type for quick stats
    const typeStats = useMemo(() => {
        const stats = { nominal: 0, ordinal: 0, scale: 0 };
        variableSets.forEach(vs => {
            if (vs.type && vs.type in stats) {
                stats[vs.type as keyof typeof stats]++;
            }
        });
        return stats;
    }, [variableSets]);

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
        }
    };

    // Keyboard shortcuts
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Ignore if typing in input
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        if (event.key === 'Escape') {
            if (selectedVariableSetIds.length > 0) {
                clearSelection();
            } else {
                onClose();
            }
        }

        if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
            event.preventDefault();
            selectAllVariableSets(filteredIds);
        }
    }, [selectedVariableSetIds, clearSelection, selectAllVariableSets, filteredIds, onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Determine if Inspector should be visible
    const showInspector = !!selectedVariableId;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div style={{
                height: '100%',
                backgroundColor: 'var(--color-paper)',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Header */}
                <header style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-4) var(--space-6)',
                    borderBottom: '1px solid var(--gray-200)',
                    backgroundColor: 'var(--gray-50)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <Grid3X3 style={{ width: 20, height: 20, color: 'var(--color-terracotta)' }} />
                            <h1 style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 'var(--text-lg)',
                                fontWeight: 600,
                                color: 'var(--color-ink)',
                                margin: 0,
                            }}>
                                Variable Manager
                            </h1>
                        </div>

                        {/* Quick Stats */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--gray-500)',
                            marginLeft: 'var(--space-4)',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Tag size={12} style={{ color: 'var(--color-terracotta)' }} />
                                {typeStats.nominal} Categorical
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <BarChart2 size={12} style={{ color: 'var(--color-info)' }} />
                                {typeStats.scale} Numeric
                            </span>
                            <span style={{ color: 'var(--gray-300)' }}>|</span>
                            <span>{variableSets.length} total</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        {/* Search */}
                        <div style={{ position: 'relative', width: 240 }}>
                            <Search style={{
                                position: 'absolute',
                                left: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 14,
                                height: 14,
                                color: 'var(--gray-400)',
                            }} />
                            <input
                                type="text"
                                placeholder="Search variables..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px 12px 6px 32px',
                                    backgroundColor: 'var(--gray-100)',
                                    border: '1px solid var(--gray-200)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    fontSize: 'var(--text-sm)',
                                    fontFamily: 'var(--font-body)',
                                    outline: 'none',
                                }}
                            />
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                                padding: 0,
                                border: 'none',
                                borderRadius: 'var(--border-radius-sm)',
                                backgroundColor: 'transparent',
                                color: 'var(--gray-400)',
                                cursor: 'pointer',
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </header>

                {/* Faceted Search Bar */}
                <FacetedSearchBar />

                {/* Miller Columns */}
                <div className={millerStyles.container}>
                    {/* Column 1: Data Sources */}
                    <DataSourceColumn />

                    {/* Column 2: Folders */}
                    <FolderColumn />

                    {/* Column 3: Variable Sets */}
                    <VariableSetColumn />

                    {/* Column 4: Variables (conditionally shown) */}
                    <VariableColumn />

                    {/* Column 5: Inspector (conditionally shown) */}
                    {showInspector && <VariableInspector />}
                </div>

                {/* Footer */}
                <footer style={{
                    padding: 'var(--space-3) var(--space-6)',
                    borderTop: '1px solid var(--gray-200)',
                    backgroundColor: 'var(--gray-50)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--gray-500)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <span>
                        {dataset?.name} • {dataset?.rowCount.toLocaleString()} rows
                    </span>
                    <span style={{ color: 'var(--gray-400)' }}>
                        <kbd style={{
                            padding: '2px 6px',
                            backgroundColor: 'var(--gray-200)',
                            borderRadius: 3,
                        }}>⌘A</kbd> Select all •
                        <kbd style={{
                            padding: '2px 6px',
                            backgroundColor: 'var(--gray-200)',
                            borderRadius: 3,
                            marginLeft: 4,
                        }}>Esc</kbd> Close
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
