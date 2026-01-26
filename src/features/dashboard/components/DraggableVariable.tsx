import React from 'react';
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { VariableTypeIcon } from '../../../components/common/VariableTypeIcon';
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
      className={`group flex items-center gap-2 px-2 h-9 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm cursor-grab hover:border-[var(--color-accent)] hover:shadow-float transition-all active:cursor-grabbing relative pr-8
        ${isDragging ? 'ring-2 ring-[var(--color-accent)] ring-opacity-50 grayscale shadow-drag' : ''}
        ${isSelected ? 'bg-[var(--bg-active)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' : 'hover:bg-[var(--bg-panel)]'}
        ${isFocused && !isSelected ? 'border-[var(--color-accent)] bg-[var(--bg-active)] ring-1 ring-[var(--color-accent)]/30' : ''}
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
      <div className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors shrink-0 opacity-0 group-hover:opacity-100 -ml-1">
        <GripVertical size={14} />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="shrink-0 flex items-center text-[var(--text-secondary)]" title={variableSet.structure === 'single' ? variableSet.type : variableSet.structure}>
          <VariableTypeIcon
            type={variableSet.type}
            structure={variableSet.structure as any}
            size={13}
            className="text-[var(--text-secondary)]"
          />
        </span>
        <span className={`text-sm font-medium truncate font-body leading-none ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>{variableSet.name}</span>
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