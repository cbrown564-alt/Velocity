import React from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Hash, Type, BarChart2, Wand2 } from 'lucide-react';
import { Variable } from '../../../types';

interface DraggableVariableProps {
  variable: Variable;
  onDragStart: (id: string) => void;
  onDragEnd: (event: any, info: any) => void;
  onRecode?: (variable: Variable) => void;
}

export const DraggableVariable: React.FC<DraggableVariableProps> = ({
  variable,
  onDragStart,
  onDragEnd,
  onRecode
}) => {
  // Helper to get icon based on type (supports both old and new type values)
  const getIcon = (type: Variable['type']) => {
    switch (type) {
      case 'numeric':
      case 'scale':
        return <Hash size={14} className="text-slate-400" />;
      case 'categorical':
      case 'nominal':
        return <Type size={14} className="text-slate-400" />;
      case 'ordinal':
        return <BarChart2 size={14} className="text-slate-400" />;
      default:
        return <Type size={14} className="text-slate-400" />;
    }
  };

  return (
    <motion.div
      layoutId={`var-${variable.id}`}
      drag
      dragSnapToOrigin // Snaps back if not dropped in a valid zone (handled via logic)
      dragMomentum={false} // Gives a tighter, "software tool" feel rather than "physics toy"
      whileDrag={{
        scale: 1.05,
        rotate: 2,
        opacity: 0.9,
        backgroundColor: "white",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        cursor: 'grabbing',
        zIndex: 9999, // Ensure it sits on top of everything
        pointerEvents: 'none' // CRITICAL FIX: Allows document.elementFromPoint to see the drop zone underneath
      }}
      onDragStart={() => onDragStart(variable.id)}
      onDragEnd={onDragEnd}
      className="group flex items-center gap-3 p-3 mb-2 bg-white border border-gray-200 rounded-lg shadow-sm cursor-grab hover:border-indigo-300 hover:shadow-md transition-all active:cursor-grabbing relative pr-10"
    >
      <div className="text-gray-300 group-hover:text-indigo-400 transition-colors">
        <GripVertical size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 truncate">{variable.label}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {getIcon(variable.type)}
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{variable.type}</span>
        </div>
      </div>

      {/* Recode Action Button (Visible on Hover) */}
      {onRecode && (
        <button
          onPointerDown={(e) => {
            e.stopPropagation(); // Prevent drag start
            onRecode(variable);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-white border border-gray-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Recode / Group Values"
        >
          <Wand2 size={14} />
        </button>
      )}
    </motion.div>
  );
};