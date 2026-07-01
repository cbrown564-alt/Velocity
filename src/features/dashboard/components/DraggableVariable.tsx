import React from 'react';
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Plus, GitBranch } from 'lucide-react';
import { VariableTypeIcon } from '../../../components/common/VariableTypeIcon';
import { VariableSet } from '../../../types';
import { useVelocityStore } from '../../../store';

interface VariableCardProps {
  variableSet: VariableSet;
  isDragging?: boolean;
  isOverlay?: boolean;
  isSelected?: boolean;
  /** Indicates this card has bi-directional focus (from Variable Manager) */
  isFocused?: boolean;
  /** Cross-surface hover highlight (Living Inspector) */
  isHovered?: boolean;
  /** Which shelf this variable currently occupies, if any */
  shelfType?: 'row' | 'col' | 'weight' | null;
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
  isHovered,
  isOverlay,
  shelfType,
  onClick,
  onContextMenu,
  dragListeners,
  dragAttributes,
  setNodeRef,
  style,
}) => {
  const setHoveredVariableSetId = useVelocityStore((state) => state.setHoveredVariableSetId);

  const cardStyle = {
    ...style,
    opacity: isDragging ? 0.3 : 1,
  };

  const Component = isOverlay ? 'div' : motion.div;
  const shelfColor = shelfType ? `var(--shelf-${shelfType})` : undefined;

  return (
    <Component
      ref={setNodeRef}
      data-testid={isOverlay ? 'variable-drag-overlay' : 'variable-draggable'}
      data-variable-set-id={variableSet.id}
      layoutId={isOverlay ? undefined : `var-${variableSet.id}`}
      style={cardStyle}
      {...dragListeners}
      {...dragAttributes}
      className={`group flex items-start gap-2 px-2 py-1.5 min-h-9 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm cursor-grab hover:border-[var(--color-accent)] hover:shadow-float transition-all active:cursor-grabbing relative pr-8
        ${isDragging ? 'ring-2 ring-[var(--color-accent)] ring-opacity-50 grayscale shadow-drag' : ''}
        ${isSelected ? 'bg-[var(--bg-active)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' : 'hover:bg-[var(--bg-panel)]'}
        ${isFocused && !isSelected ? 'border-[var(--color-accent)] bg-[var(--bg-active)] ring-1 ring-[var(--color-accent)]/30' : ''}
        ${isHovered && !isSelected && !isFocused ? 'border-[var(--color-accent)]/60 bg-[color-mix(in_srgb,var(--color-accent),transparent_94%)]' : ''}
        ${isOverlay ? 'shadow-xl scale-105 cursor-grabbing !opacity-100 z-50' : ''}
      `}
      onMouseEnter={() => setHoveredVariableSetId(variableSet.id)}
      onMouseLeave={() => setHoveredVariableSetId(null)}
      onClick={(e: React.MouseEvent) => !isDragging && onClick?.(variableSet, e)}
      onContextMenu={(e: React.MouseEvent) => {
        if (!isDragging && onContextMenu) {
          e.preventDefault();
          onContextMenu(variableSet, e);
        }
      }}
    >
      {/* Shelf color indicator */}
      {shelfType && (
        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ background: shelfColor }} />
      )}

      <div
        className="w-4 shrink-0 flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors"
        aria-hidden
      >
        <GripVertical size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className="shrink-0 flex items-center text-[var(--text-secondary)]"
          title={variableSet.structure === 'single' ? variableSet.type : variableSet.structure}
        >
          <VariableTypeIcon
            type={variableSet.type}
            structure={variableSet.structure as any}
            size={13}
            className="text-[var(--text-secondary)]"
          />
        </span>
        <span
          className={`text-sm font-medium font-body leading-snug line-clamp-2 min-w-0 ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}
          title={variableSet.name}
        >
          {variableSet.name}
        </span>
        {variableSet.derived && (
          <span
            className="text-[9px] px-1 py-0.5 rounded bg-[var(--bg-active)] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold shrink-0 flex items-center gap-1"
            title="Derived from recode"
          >
            <GitBranch size={9} />
            derived
          </span>
        )}
      </div>

      <div
        className="absolute right-2 text-[var(--text-secondary)] group-hover:text-[var(--color-accent)] transition-colors shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--bg-active)]"
        title="Click to assign"
      >
        <Plus size={14} />
      </div>
    </Component>
  );
};

interface DraggableVariableProps {
  variableSet: VariableSet;
  isSelected?: boolean;
  /** Indicates this card has bi-directional focus (from Variable Manager) */
  isFocused?: boolean;
  /** Cross-surface hover highlight (Living Inspector) */
  isHovered?: boolean;
  /** Which shelf this variable currently occupies, if any */
  shelfType?: 'row' | 'col' | 'weight' | null;
  onRecode?: (variableSet: VariableSet) => void;
  onClick?: (variableSet: VariableSet, e: React.MouseEvent) => void;
  onContextMenu?: (variableSet: VariableSet, e: React.MouseEvent) => void;
}

export const DraggableVariable: React.FC<DraggableVariableProps> = ({
  variableSet,
  isSelected,
  isFocused,
  isHovered,
  shelfType,
  onRecode,
  onClick,
  onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: variableSet.id,
    data: { variableSet },
  });

  return (
    <VariableCard
      variableSet={variableSet}
      isDragging={isDragging}
      isSelected={isSelected}
      isFocused={isFocused}
      isHovered={isHovered}
      shelfType={shelfType}
      onRecode={onRecode}
      onClick={onClick}
      onContextMenu={onContextMenu}
      setNodeRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes}
    />
  );
};
