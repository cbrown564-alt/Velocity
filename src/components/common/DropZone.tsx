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
            w-full min-h-[120px] p-3 rounded-lg transition-all duration-200
            ${active
              ? 'border-2 border-dashed border-[var(--color-terracotta)] border-opacity-40 bg-[var(--gray-50)]/50'
              : 'border-2 border-dashed border-transparent'
            }
            ${isOver
              ? 'ring-2 ring-[var(--color-terracotta)] bg-[var(--gray-50)] border-[var(--color-terracotta)]'
              : ''
            }
          `}
        >
          <SortableRowShelf variableSets={currentVariables} onRemove={onRemove} />

          {/* Hint text when dragging */}
          {active && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[var(--color-terracotta)] opacity-60">
              <Plus size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Add more rows</span>
            </div>
          )}
        </div>
      );
    }

    // For column type, use static pills with expanded container
    return (
      <div
        ref={setNodeRef}
        className={`
          flex flex-col gap-2 min-w-[200px] min-h-[56px] p-3 rounded-lg transition-all duration-200
          ${active
            ? 'border-2 border-dashed border-[var(--color-terracotta)] border-opacity-40 bg-[var(--gray-50)]/50'
            : 'border-2 border-dashed border-transparent'
          }
          ${isOver
            ? 'ring-2 ring-[var(--color-terracotta)] bg-[var(--gray-50)] border-[var(--color-terracotta)]'
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
            className="relative flex items-center justify-between p-2 pl-3 pr-2 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-md group"
          >
            <span className="text-sm font-medium text-[var(--color-ink)] font-body truncate max-w-[160px]" title={set.name}>{set.name}</span>
            <button
              onClick={() => onRemove(set.id)}
              className="ml-2 p-1 text-[var(--gray-400)] hover:text-[var(--color-terracotta)] hover:bg-[var(--gray-100)] rounded-full transition-colors"
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
        relative flex items-center justify-center transition-all duration-200 rounded-lg border-2 border-dashed
        ${isOver
          ? 'border-[var(--color-terracotta)] bg-[var(--gray-50)] text-[var(--color-terracotta)] scale-[1.02] shadow-sm'
          : active
            ? 'border-[var(--color-terracotta)] border-opacity-60 bg-[var(--gray-50)]/50 text-[var(--color-terracotta)]'
            : 'border-[var(--gray-200)] text-[var(--gray-400)] hover:border-[var(--gray-300)] hover:bg-[var(--gray-50)]'
        }
        ${type === 'column'
          ? 'h-14 min-w-[200px]'
          : 'min-h-[100px] w-full'
        }
      `}
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <Plus size={16} className={(active || isOver) ? "text-[var(--color-terracotta)]" : "text-[var(--gray-300)]"} />
        <span className="text-xs font-medium uppercase tracking-wide font-body">{label}</span>
      </div>
    </div>
  );
};
