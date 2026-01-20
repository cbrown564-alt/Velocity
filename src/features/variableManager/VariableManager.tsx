/**
 * VariableManager Component
 * 
 * The "Data Gardening" spoke in the hub-and-spoke architecture.
 * Full-screen overlay for organizing and managing variables.
 * 
 * Features (Milestone 2.2 - Card Sorting):
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
    DragOverEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { X, Search, Grid3X3, List, Tag, BarChart2 } from 'lucide-react';
import { useVelocityStore } from '../../store';
import { SortableVariableCard } from './SortableVariableCard';
import { BulkActionBar } from './BulkActionBar';
import { FolderPanel } from './FolderPanel';

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
        activeFolderId,
        toggleVariableSetSelection,
        selectVariableSetRange,
        selectAllVariableSets,
        clearSelection,
        reorderVariableSets,
        moveToFolder,
    } = useVelocityStore();

    const [viewStyle, setViewStyle] = React.useState<'grid' | 'list'>('grid');

    // Configure dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Filter variable sets by search and folder
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

        return sets;
    }, [variableSets, searchQuery, activeFolderId]);

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

    // Handle drag end for reordering
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
        } else {
            reorderVariableSets(String(active.id), String(over.id));
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

    const handleSelect = (id: string, multi: boolean) => {
        toggleVariableSetSelection(id, multi);
    };

    const handleShiftSelect = (id: string) => {
        selectVariableSetRange(id, filteredIds);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="h-full bg-white flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Grid3X3 className="w-5 h-5 text-indigo-600" />
                            <h1 className="text-lg font-semibold text-gray-900">Variable Manager</h1>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center gap-3 text-xs text-gray-500 ml-4">
                            <span className="flex items-center gap-1">
                                <Tag size={12} className="text-rose-500" />
                                {typeStats.nominal} Categorical
                            </span>
                            <span className="flex items-center gap-1">
                                <BarChart2 size={12} className="text-blue-500" />
                                {typeStats.scale} Numeric
                            </span>
                            <span className="text-gray-300">|</span>
                            <span>{variableSets.length} total</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* View Toggle */}
                        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setViewStyle('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewStyle === 'grid'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <Grid3X3 size={16} />
                            </button>
                            <button
                                onClick={() => setViewStyle('list')}
                                className={`p-1.5 rounded-md transition-all ${viewStyle === 'list'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <List size={16} />
                            </button>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </header>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-gray-100 bg-white">
                    <div className="relative max-w-xl">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search variables..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white transition-all outline-none"
                        />
                    </div>
                </div>

                {/* Main Content with Folder Panel */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Folder Panel */}
                    <FolderPanel />

                    {/* Card Grid */}
                    <main className="flex-1 overflow-auto p-6">
                        <SortableContext items={filteredIds} strategy={rectSortingStrategy}>
                            {viewStyle === 'grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {filteredSets.map((vs) => (
                                        <SortableVariableCard
                                            key={vs.id}
                                            id={vs.id}
                                            name={vs.name}
                                            type={vs.type}
                                            structure={vs.structure}
                                            isSelected={selectedVariableSetIds.includes(vs.id)}
                                            hidden={vs.hidden}
                                            onSelect={handleSelect}
                                            onShiftSelect={handleShiftSelect}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2 max-w-4xl">
                                    {filteredSets.map((vs) => (
                                        <SortableVariableCard
                                            key={vs.id}
                                            id={vs.id}
                                            name={vs.name}
                                            type={vs.type}
                                            structure={vs.structure}
                                            isSelected={selectedVariableSetIds.includes(vs.id)}
                                            hidden={vs.hidden}
                                            onSelect={handleSelect}
                                            onShiftSelect={handleShiftSelect}
                                        />
                                    ))}
                                </div>
                            )}
                        </SortableContext>

                        {filteredSets.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <Grid3X3 size={48} className="opacity-20 mb-4" />
                                <p className="text-sm font-medium">No variables found</p>
                                {searchQuery && (
                                    <p className="text-xs mt-1">Try adjusting your search</p>
                                )}
                            </div>
                        )}
                    </main>
                </div>

                {/* Footer */}
                <footer className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                    <span>
                        {dataset?.name} • {dataset?.rowCount.toLocaleString()} rows
                    </span>
                    <span className="text-gray-400">
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">⌘A</kbd> Select all •
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded ml-1">Esc</kbd> Close
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
