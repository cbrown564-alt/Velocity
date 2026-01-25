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
              ? 'bg-white border-2 border-dashed border-indigo-200'
              : 'border-2 border-transparent bg-transparent'
            }
            ${isOver
              ? 'ring-2 ring-indigo-500 bg-white border-indigo-500'
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
            ? 'bg-white border-2 border-dashed border-indigo-200'
            : 'border-2 border-dashed border-transparent'
          }
          ${isOver
            ? 'ring-2 ring-indigo-500 bg-white border-indigo-500'
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
        relative flex items-center justify-start px-3 transition-all duration-200 rounded-md border border-dashed
        ${isOver
          ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
          : active
            ? 'border-indigo-300 bg-white text-indigo-400'
            : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:bg-gray-50'
        }
        h-10 w-full min-w-[200px]
      `}
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <Plus size={16} className={(active || isOver) ? "text-[var(--color-terracotta)]" : "text-[var(--gray-300)]"} />
        <span className="text-xs font-medium uppercase tracking-wide font-body">{label}</span>
      </div>
    </div>
  );
};
