/**
 * BulkActionBar Component
 * 
 * Floating action bar displayed when items are selected in Variable Manager.
 * Provides bulk operations: Group, Change Type, Hide/Show.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderPlus, Eye, EyeOff, Tag, BarChart2, Layers, X } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { VariableType } from '../../store/slices/dataSlice';
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
                {selectedCount > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
                    >
                        <div className="bg-paper border border-gray-200 text-ink rounded-xl shadow-float px-4 py-3 flex items-center gap-4">
                            {/* Selection Count */}
                            <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
                                <span className="bg-terracotta text-white text-xs font-bold px-2 py-1 rounded-full">
                                    {selectedCount}
                                </span>
                                <span className="text-sm text-gray-500 font-body">selected</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                                {/* Create Group */}
                                <button
                                    onClick={handleCreateGroup}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 hover:text-ink"
                                >
                                    <FolderPlus size={16} />
                                    <span>Group</span>
                                </button>

                                {/* Change Type */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowTypeMenu(!showTypeMenu)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${showTypeMenu ? 'bg-gray-100 text-ink' : 'text-gray-700 hover:bg-gray-100 hover:text-ink'}`}
                                    >
                                        <Tag size={16} />
                                        <span>Type</span>
                                    </button>

                                    {showTypeMenu && (
                                        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-float py-1 min-w-32 z-50 overflow-hidden">
                                            <button
                                                onClick={() => handleSetType('nominal')}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm font-body text-gray-700"
                                            >
                                                <Tag size={14} className="text-terracotta" />
                                                Nominal
                                            </button>
                                            <button
                                                onClick={() => handleSetType('ordinal')}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm font-body text-gray-700"
                                            >
                                                <Layers size={14} className="text-info" />
                                                Ordinal
                                            </button>
                                            <button
                                                onClick={() => handleSetType('scale')}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm font-body text-gray-700"
                                            >
                                                <BarChart2 size={14} className="text-charcoal" />
                                                Scale
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Hide/Show */}
                                <button
                                    onClick={handleToggleHide}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 hover:text-ink"
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
                                className="ml-2 p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
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
