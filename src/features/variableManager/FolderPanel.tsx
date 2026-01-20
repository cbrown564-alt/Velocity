/**
 * FolderPanel Component
 * 
 * Left sidebar in Variable Manager showing folder list.
 * Supports creating folders and filtering by folder.
 */

import React, { useState } from 'react';
import { Folder, FolderPlus, Trash2, ChevronRight, Layers } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { useVelocityStore } from '../../store';

interface FolderItemProps {
    id: string;
    name: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
    onDelete: () => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
    id,
    name,
    count,
    isActive,
    onClick,
    onDelete,
}) => {
    const { setNodeRef, isOver } = useDroppable({ id: `folder-${id}` });

    return (
        <div
            ref={setNodeRef}
            onClick={onClick}
            className={`
                group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                transition-all duration-150
                ${isActive
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'hover:bg-gray-100 text-gray-700'
                }
                ${isOver ? 'ring-2 ring-indigo-400 bg-indigo-50' : ''}
            `}
        >
            <div className="flex items-center gap-2">
                <Folder size={16} className={isActive ? 'text-indigo-500' : 'text-gray-400'} />
                <span className="text-sm font-medium truncate max-w-32">{name}</span>
            </div>
            <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">{count}</span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
};

export const FolderPanel: React.FC = () => {
    const {
        folders,
        variableSets,
        activeFolderId,
        setActiveFolderId,
        createFolder,
        deleteFolder,
    } = useVelocityStore();

    const [isCreating, setIsCreating] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Count variables per folder
    const folderCounts = React.useMemo(() => {
        const counts: Record<string, number> = { ungrouped: 0 };
        folders.forEach(f => counts[f.id] = 0);

        variableSets.forEach(vs => {
            if (vs.folderId && counts[vs.folderId] !== undefined) {
                counts[vs.folderId]++;
            } else {
                counts.ungrouped++;
            }
        });

        return counts;
    }, [folders, variableSets]);

    const handleCreateFolder = () => {
        if (newFolderName.trim()) {
            createFolder(newFolderName.trim());
            setNewFolderName('');
            setIsCreating(false);
        }
    };

    const handleDeleteFolder = (folderId: string) => {
        if (confirm('Delete this folder? Variables will be moved to ungrouped.')) {
            deleteFolder(folderId);
            if (activeFolderId === folderId) {
                setActiveFolderId(null);
            }
        }
    };

    // Drop zone for ungrouped
    const { setNodeRef: setUngroupedRef, isOver: isOverUngrouped } = useDroppable({
        id: 'folder-ungrouped',
    });

    return (
        <div className="w-56 border-r border-gray-200 bg-gray-50 p-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Folders
                </h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Create folder"
                >
                    <FolderPlus size={16} />
                </button>
            </div>

            <div className="space-y-1 flex-1 overflow-auto">
                {/* All Variables */}
                <div
                    onClick={() => setActiveFolderId(null)}
                    className={`
                        flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                        transition-colors
                        ${activeFolderId === null
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }
                    `}
                >
                    <div className="flex items-center gap-2">
                        <Layers size={16} className={activeFolderId === null ? 'text-indigo-500' : 'text-gray-400'} />
                        <span className="text-sm font-medium">All Variables</span>
                    </div>
                    <span className="text-xs text-gray-400">{variableSets.length}</span>
                </div>

                {/* Ungrouped */}
                <div
                    ref={setUngroupedRef}
                    onClick={() => setActiveFolderId('ungrouped')}
                    className={`
                        flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                        transition-all
                        ${activeFolderId === 'ungrouped'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }
                        ${isOverUngrouped ? 'ring-2 ring-indigo-400 bg-indigo-50' : ''}
                    `}
                >
                    <div className="flex items-center gap-2">
                        <Folder size={16} className={activeFolderId === 'ungrouped' ? 'text-indigo-500' : 'text-gray-400'} />
                        <span className="text-sm font-medium">Ungrouped</span>
                    </div>
                    <span className="text-xs text-gray-400">{folderCounts.ungrouped}</span>
                </div>

                {/* Divider */}
                {folders.length > 0 && <div className="border-t border-gray-200 my-2" />}

                {/* Custom Folders */}
                {folders.map(folder => (
                    <FolderItem
                        key={folder.id}
                        id={folder.id}
                        name={folder.name}
                        count={folderCounts[folder.id] || 0}
                        isActive={activeFolderId === folder.id}
                        onClick={() => setActiveFolderId(folder.id)}
                        onDelete={() => handleDeleteFolder(folder.id)}
                    />
                ))}

                {/* New Folder Input */}
                {isCreating && (
                    <div className="px-2 py-1">
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder();
                                if (e.key === 'Escape') setIsCreating(false);
                            }}
                            onBlur={handleCreateFolder}
                            autoFocus
                            placeholder="Folder name..."
                            className="w-full px-2 py-1 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <div className="mt-4 pt-3 border-t border-gray-200 text-[10px] text-gray-400 text-center">
                Drag cards to folders
            </div>
        </div>
    );
};
