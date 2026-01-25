import React from 'react';
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Hash, Grid3x3, Tag, SlidersHorizontal, CheckCircle, SquareCheck } from 'lucide-react';
import { VariableSet, VariableType } from '../../../types';

interface VariableCardProps {
  variableSet: VariableSet;
  isDragging?: boolean;
  isOverlay?: boolean;
  isSelected?: boolean;
  /** Indicates this card has bi-directional focus (from Variable Manager) */
  isFocused?: boolean;
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
  isFocused,
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
    if (set.structure === 'grid') {
      return <Grid3x3 size={14} className="text-[var(--gray-500)]" />;
    }

    if (set.structure === 'multiple') {
      return <SquareCheck size={14} className="text-[var(--gray-500)]" />;
    }

    const type = set.type as VariableType;
    switch (type) {
      case 'numeric':
        return <Hash size={13} className="text-[var(--gray-500)]" />;
      case 'scale':
        return <SlidersHorizontal size={13} className="text-[var(--gray-500)]" />;
      case 'date':
        return <Hash size={13} className="text-[var(--gray-500)]" />;
      case 'nominal':
      case 'text':
        return <CheckCircle size={13} className="text-[var(--gray-500)]" />;
      case 'ordinal':
        return <CheckCircle size={13} className="text-[var(--gray-500)]" />;
      default:
        return <CheckCircle size={13} className="text-[var(--gray-500)]" />;
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
      className={`group flex items-center gap-2 px-2 h-9 bg-[var(--color-parchment)] border border-[var(--gray-200)] rounded-lg shadow-sm cursor-grab hover:border-[var(--color-terracotta)] hover:shadow-md transition-all active:cursor-grabbing relative pr-8
        ${isDragging ? 'ring-2 ring-[var(--color-terracotta)] ring-opacity-50 grayscale' : ''}
        ${isSelected ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : ''}
        ${isFocused && !isSelected ? 'border-[var(--color-terracotta)] bg-[var(--color-terracotta)]/5 ring-1 ring-[var(--color-terracotta)]/30' : ''}
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
      <div className="text-[var(--gray-400)] group-hover:text-[var(--color-terracotta)] transition-colors shrink-0">
        <GripVertical size={14} />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="shrink-0 flex items-center" title={variableSet.structure === 'single' ? variableSet.type : variableSet.structure}>
          {getIcon(variableSet)}
        </span>
        <span className="text-sm font-medium text-[var(--color-ink)] truncate font-body leading-none">{variableSet.name}</span>
      </div>


    </Component>
  );
};

interface DraggableVariableProps {
  variableSet: VariableSet;
  isSelected?: boolean;
  /** Indicates this card has bi-directional focus (from Variable Manager) */
  isFocused?: boolean;
  onRecode?: (variableSet: VariableSet) => void;
  onClick?: (variableSet: VariableSet, e: React.MouseEvent) => void;
  onContextMenu?: (variableSet: VariableSet, e: React.MouseEvent) => void;
}

export const DraggableVariable: React.FC<DraggableVariableProps> = ({
  variableSet,
  isSelected,
  isFocused,
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
      isFocused={isFocused}
      onRecode={onRecode}
      onClick={onClick}
      onContextMenu={onContextMenu}
      setNodeRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes}
    />
  );
};