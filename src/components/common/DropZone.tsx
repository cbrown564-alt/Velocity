import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Variable } from '../../types';

interface DropZoneProps {
  id: string; // The DOM id used for collision detection
  type: 'row' | 'column';
  label: string;
  active: boolean; // Is the user currently dragging something globally?
  currentVariable: Variable | null;
  onRemove: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  id,
  type,
  label,
  active,
  currentVariable,
  onRemove,
}) => {

  if (currentVariable) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative flex items-center justify-between p-2 pl-3 pr-2 bg-indigo-50 border border-indigo-200 rounded-md group
          ${type === 'column' ? 'min-w-[120px]' : 'w-full'}`}
      >
        <span className="text-sm font-medium text-indigo-700">{currentVariable.label}</span>
        <button
          onClick={onRemove}
          className="ml-2 p-1 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-full transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </motion.div>
    );
  }

  return (
    <div
      id={id} // CRITICAL: This ID is read by document.elementFromPoint on dragEnd
      className={`relative flex items-center justify-center transition-all duration-200 rounded-lg border-2 border-dashed
        ${active
          ? 'border-indigo-400 bg-indigo-50/50 text-indigo-600 scale-[1.01]'
          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
        }
        ${type === 'column'
          ? 'h-10 w-48'
          : 'h-16 w-full'
        }
      `}
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <Plus size={16} className={active ? "text-indigo-500" : "text-gray-300"} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
    </div>
  );
};
