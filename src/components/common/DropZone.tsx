import React from 'react';
import { motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { VariableSet } from '../../types';
import { SortableRowShelf } from './SortableRowShelf';

interface DropZoneProps {
  id: string; // The DOM id used for collision detection
  type: 'row' | 'column';
  label: string;
  active: boolean; // Is the user currently dragging something globally?
  currentVariables: VariableSet[];
  onRemove: (id: string) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  id,
  type,
  label,
  active,
  currentVariables,
  onRemove,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const hasVariables = currentVariables.length > 0;

  // Populated state: Render pills with expanded droppable area around them
  if (hasVariables) {
    // For row type, use sortable shelf with expanded container
    if (type === 'row') {
      return (
        <div
          ref={setNodeRef}
          className={`
            w-full min-h-[52px] px-2 py-1.5 rounded-md transition-all duration-200 flex items-center
            ${active
              ? 'bg-[var(--bg-surface)] border-2 border-dashed border-[color-mix(in_srgb,var(--color-accent),transparent_70%)] backdrop-blur-sm'
              : 'border-2 border-transparent bg-transparent'
            }
            ${isOver
              ? 'ring-2 ring-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] border-[var(--color-accent)]'
              : ''
            }
          `}
        >
          <SortableRowShelf variableSets={currentVariables} onRemove={onRemove} />
        </div>
      );
    }

    // For column type, use static pills with expanded container
    return (
      <div
        ref={setNodeRef}
        className={`
          flex flex-row flex-wrap gap-2 min-w-[120px] min-h-[40px] px-2 py-1.5 rounded-md transition-all duration-200 items-center
          ${active
            ? 'bg-[var(--bg-surface)] border-2 border-dashed border-[color-mix(in_srgb,var(--color-accent),transparent_70%)] backdrop-blur-sm'
            : 'border-2 border-dashed border-transparent'
          }
          ${isOver
            ? 'ring-2 ring-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] border-[var(--color-accent)]'
            : ''
          }
        `}
      >
        {currentVariables.map((set) => (
          <motion.div
            key={set.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex items-center justify-between p-2 pl-3 pr-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-md group"
          >
            <span className="text-sm font-medium text-[var(--text-primary)] font-body truncate max-w-[160px]" title={set.name}>{set.name}</span>
            <button
              onClick={() => onRemove(set.id)}
              className="ml-2 p-1 text-[var(--text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--bg-active)] rounded-full transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </motion.div>
        ))}
      </div>
    );
  }

  // Empty state: Generous dimensions with clear visual affordance
  return (
    <div
      ref={setNodeRef}
      className={`
        relative flex items-center justify-start px-3 transition-all duration-200 rounded-md border border-dashed
        ${isOver
          ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_90%)] text-[var(--color-accent)]'
          : active
            ? 'border-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] text-[color-mix(in_srgb,var(--color-accent),transparent_30%)]'
            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-color-active)] hover:bg-[var(--bg-active)]'
        }
        h-10 w-full min-w-[200px]
      `}
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <Plus size={16} className={(active || isOver) ? "text-[var(--color-accent)]" : "text-[var(--text-secondary)]"} />
        <span className="text-xs font-medium uppercase tracking-widest font-mono">{label}</span>
      </div>
    </div>
  );
};
