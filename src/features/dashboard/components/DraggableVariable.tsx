import React from 'react';
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Hash, Type, BarChart2, Wand2, Layers, Grid } from 'lucide-react';
import { VariableSet, VariableType } from '../../../types';

interface VariableCardProps {
  variableSet: VariableSet;
  isDragging?: boolean;
  isOverlay?: boolean;
  isSelected?: boolean;
  onRecode?: (variableSet: VariableSet) => void;
  onClick?: (variableSet: VariableSet, e: React.MouseEvent) => void;
  onContextMenu?: (variableSet: VariableSet, e: React.MouseEvent) => void;
  dragListeners?: any;
  dragAttributes?: any;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
}

export const VariableCard: React.FC<VariableCardProps> = ({
  variableSet,
  isDragging,
  isSelected,
  isOverlay,
  onRecode,
  onClick,
  onContextMenu,
  dragListeners,
  dragAttributes,
  setNodeRef,
  style
}) => {
  // Helper to get icon based on type and structure
  const getIcon = (set: VariableSet) => {
    if (set.structure === 'multi' || set.structure === 'grid') {
      return <Layers size={14} className="text-[var(--color-terracotta)]" />;
    }

    const type = set.type as VariableType;
    switch (type) {
      case 'numeric':
      case 'scale':
        return <Hash size={14} className="text-[var(--gray-400)]" />;
      case 'categorical':
      case 'nominal':
        return <Type size={14} className="text-[var(--gray-400)]" />;
      case 'ordinal':
        return <BarChart2 size={14} className="text-[var(--gray-400)]" />;
      default:
        return <Type size={14} className="text-[var(--gray-400)]" />;
    }
  };

  const cardStyle = {
    ...style,
    opacity: isDragging ? 0.3 : 1,
  };

  const Component = isOverlay ? 'div' : motion.div;

  return (
    <Component
      ref={setNodeRef}
      layoutId={isOverlay ? undefined : `var-${variableSet.id}`}
      style={cardStyle}
      {...dragListeners}
      {...dragAttributes}
      className={`group flex items-center gap-3 p-3 h-14 bg-[var(--color-parchment)] border border-[var(--gray-200)] rounded-lg shadow-sm cursor-grab hover:border-[var(--color-terracotta)] hover:shadow-md transition-all active:cursor-grabbing relative pr-10 
        ${isDragging ? 'ring-2 ring-[var(--color-terracotta)] ring-opacity-50 grayscale' : ''}
        ${isSelected ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : ''}
        ${isOverlay ? 'shadow-xl scale-105 cursor-grabbing !opacity-100 z-50' : ''}
      `}
      onClick={(e: React.MouseEvent) => !isDragging && onClick?.(variableSet, e)}
      onContextMenu={(e: React.MouseEvent) => {
        if (!isDragging && onContextMenu) {
          e.preventDefault();
          onContextMenu(variableSet, e);
        }
      }}
    >
      <div className="text-[var(--gray-300)] group-hover:text-[var(--color-terracotta)] transition-colors">
        <GripVertical size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-ink)] truncate font-body">{variableSet.name}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {getIcon(variableSet)}
          <span className="text-[10px] uppercase tracking-wider text-[var(--gray-400)] font-semibold font-body">
            {variableSet.structure === 'single' ? variableSet.type : variableSet.structure}
          </span>
        </div>
      </div>

      {/* Recode Action Button (Visible on Hover) */}
      {onRecode && !isOverlay && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation(); // Prevent drag start
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRecode(variableSet);
            }}
            className="p-1.5 rounded-md bg-[var(--color-paper)] border border-[var(--gray-200)] text-[var(--gray-400)] hover:text-[var(--color-terracotta)] hover:border-[var(--color-terracotta)] hover:bg-[var(--gray-50)] shadow-sm opacity-0 group-hover:opacity-100 transition-all"
            title="Recode / Group Values"
          >
            <Wand2 size={14} />
          </button>
        </div>
      )}
    </Component>
  );
};

interface DraggableVariableProps {
  variableSet: VariableSet;
  isSelected?: boolean;
  onRecode?: (variableSet: VariableSet) => void;
  onClick?: (variableSet: VariableSet, e: React.MouseEvent) => void;
  onContextMenu?: (variableSet: VariableSet, e: React.MouseEvent) => void;
}

export const DraggableVariable: React.FC<DraggableVariableProps> = ({
  variableSet,
  isSelected,
  onRecode,
  onClick,
  onContextMenu
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: variableSet.id,
    data: { variableSet }
  });

  return (
    <VariableCard
      variableSet={variableSet}
      isDragging={isDragging}
      isSelected={isSelected}
      onRecode={onRecode}
      onClick={onClick}
      onContextMenu={onContextMenu}
      setNodeRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes}
    />
  );
};