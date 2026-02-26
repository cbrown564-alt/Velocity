/**
 * FolderColumn Component
 *
 * Column 2 in the Miller Column navigation.
 * Displays folders for organizing variable sets.
 * Supports creating folders and drag-drop targets.
 */

import React, { useState, useMemo } from 'react';
import { Folder, FolderPlus, Layers, ChevronRight, Trash2 } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { useVelocityStore } from '../../store';
import { filterSyntheticGridShellSets } from './variableSetFilters';
import styles from './MillerColumns.module.css';

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
            className={`${styles.item} ${isActive ? styles.itemActive : ''} ${isOver ? styles.dropTarget : ''}`}
        >
            <div className={styles.itemContent}>
                <Folder className={styles.itemIcon} size={16} />
                <span className={styles.itemLabel}>{name}</span>
            </div>
            <div className={styles.itemMeta}>
                <span className={styles.itemCount}>{count}</span>
                {!isActive && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className={styles.columnAction}
                        style={{ width: 20, height: 20, opacity: 0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                        <Trash2 size={12} />
                    </button>
                )}
                <ChevronRight className={styles.itemChevron} size={14} />
            </div>
        </div>
    );
};

interface FolderColumnProps {
    className?: string;
}

export const FolderColumn: React.FC<FolderColumnProps> = ({ className }) => {
    const {
        dataset,
        folders,
        variableSets,
        activeFolderId,
        setActiveFolderId,
        createFolder,
        deleteFolder,
    } = useVelocityStore();

    const [isCreating, setIsCreating] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const visibleVariableSets = useMemo(
        () => filterSyntheticGridShellSets(variableSets, dataset),
        [variableSets, dataset]
    );

    // Count variables per folder
    const folderCounts = useMemo(() => {
        const counts: Record<string, number> = { ungrouped: 0 };
        folders.forEach(f => counts[f.id] = 0);

        visibleVariableSets.forEach(vs => {
            if (vs.folderId && counts[vs.folderId] !== undefined) {
                counts[vs.folderId]++;
            } else {
                counts.ungrouped++;
            }
        });

        return counts;
    }, [folders, visibleVariableSets]);

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
        <div className={`${styles.column} ${styles.col2} ${className || ''}`}>
            <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>Folders</span>
                <button
                    onClick={() => setIsCreating(true)}
                    className={styles.columnAction}
                    title="Create folder"
                >
                    <FolderPlus size={14} />
                </button>
            </div>

            <div className={styles.columnContent}>
                {/* All Variables */}
                <div
                    onClick={() => setActiveFolderId(null)}
                    className={`${styles.item} ${activeFolderId === null ? styles.itemActive : ''}`}
                >
                    <div className={styles.itemContent}>
                        <Layers className={styles.itemIcon} size={16} />
                        <span className={styles.itemLabel}>All Variables</span>
                    </div>
                    <div className={styles.itemMeta}>
                        <span className={styles.itemCount}>{visibleVariableSets.length}</span>
                        <ChevronRight className={styles.itemChevron} size={14} />
                    </div>
                </div>

                {/* Ungrouped */}
                <div
                    ref={setUngroupedRef}
                    onClick={() => setActiveFolderId('ungrouped')}
                    className={`${styles.item} ${activeFolderId === 'ungrouped' ? styles.itemActive : ''} ${isOverUngrouped ? styles.dropTarget : ''}`}
                >
                    <div className={styles.itemContent}>
                        <Folder className={styles.itemIcon} size={16} />
                        <span className={styles.itemLabel}>Ungrouped</span>
                    </div>
                    <div className={styles.itemMeta}>
                        <span className={styles.itemCount}>{folderCounts.ungrouped}</span>
                        <ChevronRight className={styles.itemChevron} size={14} />
                    </div>
                </div>

                {/* Divider */}
                {folders.length > 0 && <div className={styles.divider} />}

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
                    <div style={{ padding: '4px 8px' }}>
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
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: 'var(--text-sm)',
                                border: '1px solid var(--border-color-active)',
                                borderRadius: 'var(--border-radius-sm)',
                                outline: 'none',
                                fontFamily: 'var(--font-body)',
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
