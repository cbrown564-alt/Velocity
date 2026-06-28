/**
 * FolderPanel Component
 *
 * Left sidebar in Variable Manager showing folder list.
 * Supports creating folders and filtering by folder.
 */

import React, { useState } from 'react';
import { Folder, FolderPlus, Trash2, Layers } from 'lucide-react';
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

const FolderItem: React.FC<FolderItemProps> = ({ id, name, count, isActive, onClick, onDelete }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-${id}` });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
                group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-[var(--bg-active)] text-[var(--text-accent)]'
                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                }
                ${isOver ? 'ring-2 ring-[var(--border-color-active)] bg-[var(--bg-active)]' : ''}
            `}
    >
      <div className="flex items-center gap-2">
        <Folder size={16} className={isActive ? 'text-[var(--text-accent)]' : 'text-[var(--text-tertiary)]'} />
        <span className="text-sm font-medium truncate max-w-32">{name}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-tertiary)]">{count}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export const FolderPanel: React.FC = () => {
  const { folders, variableSets, activeFolderId, setActiveFolderId, createFolder, deleteFolder } = useVelocityStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const folderCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ungrouped: 0 };
    folders.forEach((f) => (counts[f.id] = 0));

    variableSets.forEach((vs) => {
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

  const { setNodeRef: setUngroupedRef, isOver: isOverUngrouped } = useDroppable({
    id: 'folder-ungrouped',
  });

  return (
    <div className="w-56 border-r border-[var(--border-color)] bg-[var(--bg-active)] p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Folders</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-accent)] transition-colors"
          title="Create folder"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      <div className="space-y-1 flex-1 overflow-auto">
        <div
          onClick={() => setActiveFolderId(null)}
          className={`
                        flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                        transition-colors
                        ${
                          activeFolderId === null
                            ? 'bg-[var(--bg-active)] text-[var(--text-accent)]'
                            : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                        }
                    `}
        >
          <div className="flex items-center gap-2">
            <Layers
              size={16}
              className={activeFolderId === null ? 'text-[var(--text-accent)]' : 'text-[var(--text-tertiary)]'}
            />
            <span className="text-sm font-medium">All Variables</span>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">{variableSets.length}</span>
        </div>

        <div
          ref={setUngroupedRef}
          onClick={() => setActiveFolderId('ungrouped')}
          className={`
                        flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                        transition-all
                        ${
                          activeFolderId === 'ungrouped'
                            ? 'bg-[var(--bg-active)] text-[var(--text-accent)]'
                            : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                        }
                        ${isOverUngrouped ? 'ring-2 ring-[var(--border-color-active)] bg-[var(--bg-active)]' : ''}
                    `}
        >
          <div className="flex items-center gap-2">
            <Folder
              size={16}
              className={activeFolderId === 'ungrouped' ? 'text-[var(--text-accent)]' : 'text-[var(--text-tertiary)]'}
            />
            <span className="text-sm font-medium">Ungrouped</span>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">{folderCounts.ungrouped}</span>
        </div>

        {folders.length > 0 && <div className="border-t border-[var(--border-color)] my-2" />}

        {folders.map((folder) => (
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
              className="w-full px-2 py-1 text-sm border border-[var(--border-color-active)] rounded focus:ring-2 focus:ring-[var(--border-color-active)]/20 outline-none bg-[var(--bg-panel)] text-[var(--text-primary)]"
            />
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-color)] text-[10px] text-[var(--text-tertiary)] text-center">
        Drag cards to folders
      </div>
    </div>
  );
};
