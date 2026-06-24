/**
 * BulkActionBar Component
 * 
 * Floating action bar displayed when items are selected in Variable Manager.
 * Provides bulk operations: Group, Change Type, Hide/Show.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../../lib/motion';
import { FolderPlus, Eye, EyeOff, Tag, BarChart2, Layers, X } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { VariableType } from '../../types';
import { InputModal } from '../../components/overlays/InputModal';

interface BulkActionBarProps {
    selectedCount: number;
    selectedIds: string[];
    onClearSelection: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
    selectedCount,
    selectedIds,
    onClearSelection,
}) => {
    const reducedMotion = useReducedMotion();
    const {
        createFolder,
        moveToFolder,
        bulkSetType,
        bulkHide,
        variableSets
    } = useVelocityStore();

    const [showTypeMenu, setShowTypeMenu] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);

    // Check if any selected items are hidden
    const anyHidden = selectedIds.some(id =>
        variableSets.find(vs => vs.id === id)?.hidden
    );

    const handleCreateGroup = () => {
        setShowFolderModal(true);
    };

    const handleFolderSubmit = (name: string) => {
        const folderId = createFolder(name);
        moveToFolder(selectedIds, folderId);
        onClearSelection();
    };

    const handleToggleHide = () => {
        bulkHide(selectedIds, !anyHidden);
        onClearSelection();
    };

    const handleSetType = (type: VariableType) => {
        bulkSetType(selectedIds, type);
        setShowTypeMenu(false);
        onClearSelection();
    };

    return (
        <>
            <InputModal
                isOpen={showFolderModal}
                onClose={() => setShowFolderModal(false)}
                onSubmit={handleFolderSubmit}
                title="Create Folder"
                placeholder="Enter folder name..."
                submitLabel="Create"
            />
            <AnimatePresence>
                {selectedCount > 1 && (
                    <motion.div
                        initial={{ y: reducedMotion ? 0 : 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: reducedMotion ? 0 : 100, opacity: 0 }}
                        transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
                    >
                        <div className="bg-[var(--mat-panel-bg,var(--bg-panel))] backdrop-blur-md border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl shadow-float px-4 py-3 flex items-center gap-4">
                            {/* Selection Count */}
                            <div className="flex items-center gap-2 pr-4 border-r border-[var(--border-color)]">
                                <span className="bg-[var(--viz-palette-2)] text-[var(--text-inverse)] text-xs font-bold px-2 py-1 rounded-full">
                                    {selectedCount}
                                </span>
                                <span className="text-sm text-[var(--text-secondary)] font-body">selected</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                                {/* Create Group */}
                                <button
                                    onClick={handleCreateGroup}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                    <FolderPlus size={16} />
                                    <span>Group</span>
                                </button>

                                {/* Change Type */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowTypeMenu(!showTypeMenu)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${showTypeMenu ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        <Tag size={16} />
                                        <span>Type</span>
                                    </button>

                                    {showTypeMenu && (
                                        <div className="absolute bottom-full left-0 mb-2 bg-[var(--mat-overlay-bg,var(--bg-panel))] backdrop-blur-md border border-[var(--border-color)] rounded-lg shadow-float py-1 min-w-32 z-50 overflow-hidden">
                                            <button
                                                onClick={() => handleSetType('categorical')}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-left text-sm font-body text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                            >
                                                <Tag size={14} className="text-[var(--viz-palette-2)]" />
                                                Category
                                            </button>
                                            <button
                                                onClick={() => handleSetType('ordered')}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-left text-sm font-body text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                            >
                                                <Layers size={14} className="text-[var(--viz-palette-4)]" />
                                                Scale
                                            </button>
                                            <button
                                                onClick={() => handleSetType('numeric')}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-left text-sm font-body text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                            >
                                                <BarChart2 size={14} className="text-[var(--viz-palette-1)]" />
                                                Numeric
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Hide/Show */}
                                <button
                                    onClick={handleToggleHide}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                    {anyHidden ? (
                                        <>
                                            <Eye size={16} />
                                            <span>Show</span>
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff size={16} />
                                            <span>Hide</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Clear Selection */}
                            <button
                                onClick={onClearSelection}
                                className="ml-2 p-2 rounded-lg hover:bg-[var(--bg-surface)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
